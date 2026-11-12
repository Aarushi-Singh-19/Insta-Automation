import test from "node:test";
import assert from "node:assert/strict";
import { executeStagingActions } from "./staging-action-executor.js";
const env = { MONGODB_STAGING_DB: "triggerdm_staging",
  MONGODB_STAGING_URI: "mongodb://localhost:27017/triggerdm_staging" };
test("executor is disabled without explicit staging send flag", async () => {
  let connected = false;
  class MongoClient { async connect() { connected = true; } }
  await assert.rejects(executeStagingActions({ env, MongoClient, fetchImpl: async () => {} }), /STAGING_SEND_DISABLED/);
  assert.equal(connected, false);
});
test("executor refuses production database even if enabled", async () => {
  let connected = false;
  class MongoClient { async connect() { connected = true; } }
  await assert.rejects(executeStagingActions({ env: { ...env, MONGODB_STAGING_DB: "automationDB",
    ENABLE_STAGING_INSTAGRAM_SEND: "true" }, MongoClient, fetchImpl: async () => {} }), /STAGING_DATABASE_REQUIRED/);
  assert.equal(connected, false);
});
test("executor refuses invalid limits before database connection", async () => {
  let connected = false;
  class MongoClient { async connect() { connected = true; } }
  await assert.rejects(executeStagingActions({ env: { ...env, ENABLE_STAGING_INSTAGRAM_SEND: "true" },
    MongoClient, fetchImpl: async () => {}, limit: 11 }), /INVALID_LIMIT/);
  assert.equal(connected, false);
});
test("empty staging outbox never sends Instagram requests", async () => {
  let requests = 0;
  let closed = false;
  class MongoClient {
    async connect() {}
    db(name) {
      assert.equal(name, "triggerdm_staging");
      return { collection: collection => {
        if (collection !== "cloudflare_staging_action_outbox") return {};
        return { find() { return { sort() { return this; }, limit() { return this; },
          async *[Symbol.asyncIterator]() {} }; } };
      } };
    }
    async close() { closed = true; }
  }
  const result = await executeStagingActions({ env: { ...env, ENABLE_STAGING_INSTAGRAM_SEND: "true" },
    MongoClient, fetchImpl: async () => { requests++; } });
  assert.deepEqual(result, { inspected: 0, completed: 0, blocked: 0, uncertain: 0 });
  assert.equal(requests, 0);
  assert.equal(closed, true);
});
