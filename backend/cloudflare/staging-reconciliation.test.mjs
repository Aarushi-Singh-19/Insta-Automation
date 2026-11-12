import test from "node:test";
import assert from "node:assert/strict";
import { reconcileStagingStates } from "./staging-reconciliation.js";
const env = { ENABLE_STAGING_RECONCILIATION: "true",
  MONGODB_STAGING_DB: "triggerdm_staging",
  MONGODB_STAGING_URI: "mongodb://localhost:27017/triggerdm_staging" };
test("disabled recovery does not connect", async () => {
  assert.deepEqual(await reconcileStagingStates({ env: { ...env, ENABLE_STAGING_RECONCILIATION: "false" } }), { skipped: "disabled" });
});
test("refuses non-staging database and invalid age", async () => {
  await assert.rejects(reconcileStagingStates({ env: { ...env, MONGODB_STAGING_DB: "automationDB" } }), /STAGING_DATABASE_REQUIRED/);
  await assert.rejects(reconcileStagingStates({ env, ageMinutes: 0 }), /INVALID_AGE/);
});
test("stale states become review-only without Graph calls or quota changes", async () => {
  const calls = [];
  const collections = new Map();
  const MongoClient = class {
    async connect() { calls.push("connect"); }
    db(name) { assert.equal(name, "triggerdm_staging"); return { collection(key) {
      if (!collections.has(key)) collections.set(key, { async updateMany(filter, update) {
        calls.push({ key, filter, update }); return { modifiedCount: 1 };
      } });
      return collections.get(key);
    } }; }
    async close() { calls.push("close"); }
  };
  const result = await reconcileStagingStates({ env, MongoClient, now: new Date("2026-11-12T12:00:00Z") });
  assert.deepEqual(result, { abandonedPlanning: 1, abandonedExecution: 1, uncertainSends: 1, retriedInstagramMessages: 0 });
  assert.deepEqual(calls.filter(c => typeof c === "object").map(c => c.key),
    ["cloudflare_staging_webhook_inbox", "cloudflare_staging_action_outbox", "cloudflare_staging_action_sends"]);
  for (const call of calls.filter(c => typeof c === "object")) {
    assert.equal(call.update.$set.status, "needs_review");
    assert.ok(!JSON.stringify(call).includes("pending"));
  }
  assert.equal(calls.at(-1), "close");
});
