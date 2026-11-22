import assert from "node:assert/strict";
import { test } from "node:test";
import { handleProductionCustomerApi } from "./production-customer-api.js";
import { issueStagingJwt } from "./staging-login.js";

const owner = "a".repeat(24);
const env = {
  TRIGGERDM_RUNTIME: "production",
  PRODUCTION_CUTOVER_APPROVED: "true",
  ENABLE_PRODUCTION_CUSTOMER_API: "true",
  ENABLE_PRODUCTION_AUTH: "true",
  MONGODB_PRODUCTION_DB: "automationDB",
  MONGODB_PRODUCTION_URI: "mongodb://fixture:fixture@localhost/automationDB",
  MONGODB_STAGING_DB: "triggerdm_staging",
  MONGODB_STAGING_URI: "mongodb://localhost/triggerdm_staging",
  PRODUCTION_JWT_SECRET: "fixture-production-secret-for-tests-only",
  STAGING_JWT_SECRET: "fixture-staging-secret-for-tests-only",
};

test("production customer APIs verify the token and use the selected production database and owner", async () => {
  const opened = [];
  class MongoClient {
    constructor(uri) { opened.push(uri); }
    async connect() {}
    db(dbName) {
      assert.equal(dbName, "automationDB");
      return {
        collection(name) {
          assert.equal(name, "rules");
          return {
            find(filter) {
              assert.equal(String(filter.userId), owner);
              return this;
            },
            project() { return this; },
            sort() { return this; },
            limit() { return this; },
            async toArray() { return []; },
          };
        },
      };
    }
    async close() { opened.push("closed"); }
  }
  const token = await issueStagingJwt(owner, env.PRODUCTION_JWT_SECRET);
  const request = new Request("https://worker.example/api/rules", {
    headers: { Authorization: "Bearer " + token, Origin: "https://triggerdm.in" },
  });
  const response = await handleProductionCustomerApi({ request, env, MongoClient });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, data: [] });
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://triggerdm.in");
  assert.deepEqual(opened, [env.MONGODB_PRODUCTION_URI, "closed"]);
});

test("environment and auth failures occur before the MongoDB client is opened", async () => {
  const token = await issueStagingJwt(owner, env.STAGING_JWT_SECRET);
  const request = new Request("https://worker.example/rules", {
    headers: { Authorization: "Bearer " + token },
  });
  let attempts = 0;
  class MongoClient { constructor() { attempts++; } }
  for (const [override, status] of [
    [{}, 401],
    [{ ENABLE_PRODUCTION_CUSTOMER_API: "false" }, 503],
    [{ PRODUCTION_CUTOVER_APPROVED: "false" }, 503],
    [{ MONGODB_PRODUCTION_URI: undefined }, 503],
    [{ MONGODB_PRODUCTION_DB: "triggerdm_staging" }, 503],
    [{ PRODUCTION_JWT_SECRET: env.STAGING_JWT_SECRET }, 503],
    [{ UPSTREAM_ORIGIN: "https://render.example" }, 503],
  ]) {
    const response = await handleProductionCustomerApi({ request, env: { ...env, ...override }, MongoClient });
    assert.equal(response.status, status);
  }
  assert.equal(attempts, 0);
});

test("production mutations require current subscription access before reaching the write service", async () => {
  const token = await issueStagingJwt(owner, env.PRODUCTION_JWT_SECRET);
  const request = new Request("https://worker.example/api/rules/" + "b".repeat(24) + "/toggle", {
    method: "PATCH", headers: { Authorization: "Bearer " + token },
  });
  let closed = false;
  class MongoClient {
    async connect() {}
    db(dbName) {
      assert.equal(dbName, "automationDB");
      return { collection(name) {
        assert.equal(name, "users");
        return { async findOne(filter) {
          assert.equal(String(filter._id), owner);
          return { subscriptionStatus: "trial", trialEndDate: new Date(0) };
        } };
      } };
    }
    async close() { closed = true; }
  }
  const response = await handleProductionCustomerApi({ request, env, MongoClient });
  assert.equal(response.status, 403);
  assert.equal(closed, true);
});

test("campaign health denies access before reading logs for a campaign the caller does not own", async () => {
  const token = await issueStagingJwt(owner, env.PRODUCTION_JWT_SECRET);
  const campaignId = "e".repeat(24);
  const request = new Request("https://worker.example/api/campaigns/" + campaignId + "/health", {
    headers: { Authorization: "Bearer " + token },
  });
  class MongoClient {
    async connect() {}
    db(name) {
      assert.equal(name, "automationDB");
      return { collection(name) {
        assert.equal(name, "campaigns");
        return { async findOne(query) {
          assert.equal(String(query.userId), owner);
          assert.equal(String(query._id), campaignId);
          return null;
        } };
      } };
    }
    async close() {}
  }
  const response = await handleProductionCustomerApi({ request, env, MongoClient });
  assert.equal(response.status, 404);
});
