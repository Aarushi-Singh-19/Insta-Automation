import assert from "node:assert/strict";
import { test } from "node:test";
import { issueStagingJwt } from "./staging-login.js";
import { handleProductionFinancialApi } from "./production-financial-api.js";

const owner = "f".repeat(24);
const env = {
  TRIGGERDM_RUNTIME: "production",
  PRODUCTION_CUTOVER_APPROVED: "true",
  ENABLE_PRODUCTION_AUTH: "true",
  ENABLE_PRODUCTION_FINANCIAL_OWNERSHIP: "true",
  ENABLE_PRODUCTION_RAZORPAY: "true",
  ENABLE_PRODUCTION_REFERRALS: "true",
  MONGODB_PRODUCTION_DB: "automationDB",
  MONGODB_PRODUCTION_URI: "mongodb://fixture:fixture@localhost/automationDB",
  PRODUCTION_JWT_SECRET: "fixture-production-jwt-secret-only",
  PRODUCTION_RAZORPAY_KEY_ID: "rzp_live_fixture",
  PRODUCTION_RAZORPAY_KEY_SECRET: "fixture",
  PRODUCTION_RAZORPAY_MONTHLY_PLAN_ID: "plan_fixture",
  PRODUCTION_RAZORPAY_WEBHOOK_SECRET: "fixture-webhook",
};

test("production rejects missing live bindings, Test Mode keys, and disabled ownership before side effects", async () => {
  const token = await issueStagingJwt(owner, env.PRODUCTION_JWT_SECRET);
  const request = new Request("https://worker.example/api/billing/history", {
    headers: { Authorization: "Bearer " + token },
  });
  let opened = 0;
  class MongoClient { constructor() { opened++; } }
  for (const override of [
    { PRODUCTION_RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_ID: "rzp_live_wrong_binding" },
    { PRODUCTION_RAZORPAY_KEY_ID: "rzp_test_fixture" },
    { ENABLE_PRODUCTION_FINANCIAL_OWNERSHIP: "false" },
    { MONGODB_PRODUCTION_DB: "triggerdm_staging" },
  ]) {
    const response = await handleProductionFinancialApi({ env: { ...env, ...override }, request, MongoClient });
    assert.equal(response.status, 503);
  }
  assert.equal(opened, 0);
});

test("production rejects unsigned webhook requests before MongoDB or Razorpay", async () => {
  let operations = 0;
  class MongoClient { constructor() { operations++; } }
  const request = new Request("https://worker.example/api/billing/razorpay-webhook", {
    method: "POST", body: JSON.stringify({ event: "payment.captured" }),
  });
  const response = await handleProductionFinancialApi({ env, request, MongoClient,
    fetchImpl: async () => { operations++; } });
  assert.equal(response.status, 403);
  assert.equal(operations, 0);
});

test("production history uses the production database and scopes legacy data to the JWT owner", async () => {
  const token = await issueStagingJwt(owner, env.PRODUCTION_JWT_SECRET);
  const request = new Request("https://worker.example/billing/history", {
    headers: { Authorization: "Bearer " + token },
  });
  class MongoClient {
    constructor(uri) { assert.equal(uri, env.MONGODB_PRODUCTION_URI); }
    async connect() {}
    db(name) {
      assert.equal(name, "automationDB");
      return { collection(name) {
        assert.equal(name, "payments");
        return {
          find(query) { assert.equal(String(query.userId), owner); return this; },
          sort() { return this; },
          limit() { return this; },
          async toArray() { return [{ paymentId: "pay_legacy" }]; },
        };
      } };
    }
    async close() {}
  }
  const response = await handleProductionFinancialApi({ env, request, MongoClient });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, payments: [{ paymentId: "pay_legacy" }] });
});
