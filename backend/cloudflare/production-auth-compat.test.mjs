import assert from "node:assert/strict";
import { test } from "node:test";
import { issueStagingJwt } from "./staging-login.js";
import { handleProductionInstagramOAuth } from "./production-instagram-oauth.js";
import { handleProductionCustomerApi } from "./production-customer-api.js";
import { handleProductionAuthActions } from "./production-auth-actions.js";

const owner = "a".repeat(24);
const env = {
  TRIGGERDM_RUNTIME: "production", PRODUCTION_CUTOVER_APPROVED: "true",
  ENABLE_PRODUCTION_AUTH: "true", ENABLE_PRODUCTION_CUSTOMER_API: "true",
  ENABLE_PRODUCTION_AUTH_ACTIONS: "true", ENABLE_PRODUCTION_INSTAGRAM_OAUTH: "true",
  PRODUCTION_JWT_SECRET: "fixture-production-signing-secret",
  MONGODB_PRODUCTION_DB: "automationDB",
  MONGODB_PRODUCTION_URI: "mongodb://fixture:fixture@localhost/automationDB",
  PRODUCTION_INSTAGRAM_APP_ID: "1234",
  PRODUCTION_INSTAGRAM_APP_SECRET: "fixture-only",
  PRODUCTION_INSTAGRAM_REDIRECT_URI_V2: "https://worker.example/api/instagram/callback-v2",
};

test("production accepts its OAuth state for callback purpose only", async () => {
  const token = await issueStagingJwt(owner, env.PRODUCTION_JWT_SECRET);
  const request = new Request("https://worker.example/api/instagram/connect-v2", {
    headers: { Authorization: "Bearer " + token },
  });
  let connections = 0;
  class MongoClient { constructor() { connections++; } }
  const result = await handleProductionInstagramOAuth({ request, env, MongoClient });
  assert.equal(result.status, 200);
  const authorization = new URL((await result.json()).authUrl);
  assert.equal(authorization.searchParams.get("redirect_uri"), env.PRODUCTION_INSTAGRAM_REDIRECT_URI_V2);
  const state = authorization.searchParams.get("state");
  const authenticatedRoute = new Request("https://worker.example/api/rules", {
    headers: { Authorization: "Bearer " + state },
  });
  const response = await handleProductionCustomerApi({ request: authenticatedRoute, env, MongoClient });
  assert.equal(response.status, 401);
  assert.equal(connections, 0);
});

test("production password reset consumes an unexpired token in the password write", async () => {
  let consumed = false;
  class MongoClient {
    async connect() {}
    db(name) {
      assert.equal(name, "automationDB");
      return { collection(name) {
        assert.equal(name, "users");
        return { async updateOne(filter, update) {
          assert.match(filter.passwordResetTokenHash, /^[a-f0-9]{64}$/);
          assert.ok(filter.passwordResetExpires.$gt instanceof Date);
          assert.match(update.$set.password, /^\$2[aby]\$/);
          assert.ok(Object.hasOwn(update.$unset, "passwordResetTokenHash"));
          if (consumed) return { modifiedCount: 0 };
          consumed = true;
          return { modifiedCount: 1 };
        } };
      } };
    }
    async close() {}
  }
  const reset = () => handleProductionAuthActions({ env, MongoClient,
    request: new Request("https://worker.example/api/auth/reset-password", {
      method: "POST", body: JSON.stringify({ token: "f".repeat(64), password: "new-password" }),
    }) });
  assert.equal((await reset()).status, 200);
  assert.equal((await reset()).status, 400);
});
