import test from "node:test";
import assert from "node:assert/strict";
import { prepareStagingActionOutbox } from "./staging-action-outbox.js";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb://localhost:27017/triggerdm_staging" };
const validPlan = { _id: "comment:999:123", plan: { eventId: "123", postId: "202",
  campaignId: "a".repeat(24), ruleId: "b".repeat(24),
  actionsNotAuthorized: true, requiresSubscriptionAndQuotaCheck: true } };
function setup(records) {
  const stored = new Map();
  let connected = 0;
  const plans = { aggregate(pipeline) {
    assert.deepEqual(pipeline[0], { $match: { status: "awaiting_authorization" } });
    const limit = pipeline.find(stage => stage.$limit)?.$limit ?? records.length;
    const eligible = records.filter(record => !stored.has(String(record._id))).slice(0, limit);
    return { async *[Symbol.asyncIterator]() { yield* eligible; } };
  } };
  const outbox = { async updateOne(filter, update) {
    if (stored.has(filter._id)) return { upsertedCount: 0 };
    stored.set(filter._id, update.$setOnInsert);
    return { upsertedCount: 1 };
  } };
  class MongoClient {
    async connect() { connected++; }
    db(name) { assert.equal(name, "triggerdm_staging");
      return { collection: name => name === "cloudflare_staging_action_plans" ? plans : outbox }; }
    async close() {}
  }
  return { MongoClient, stored, get connected() { return connected; } };
}
test("prepares action once without authorizing or dispatching it", async () => {
  const state = setup([validPlan]);
  const first = await prepareStagingActionOutbox({ env, MongoClient: state.MongoClient });
  const second = await prepareStagingActionOutbox({ env, MongoClient: state.MongoClient });
  assert.equal(first.prepared, 1);
  assert.equal(second.prepared, 0);
  assert.equal(first.instagramMessagesSent, false);
  assert.equal(state.stored.size, 1);
  const saved = state.stored.get(validPlan._id);
  assert.equal(saved.authorized, false);
  assert.equal(saved.dispatched, false);
  assert.equal(saved.status, "awaiting_authorization");
});
test("rejects plans lacking explicit authorization gate", async () => {
  const state = setup([{ ...validPlan, plan: { ...validPlan.plan, actionsNotAuthorized: false } }]);
  const result = await prepareStagingActionOutbox({ env, MongoClient: state.MongoClient });
  assert.equal(result.prepared, 0);
  assert.equal(state.stored.size, 0);
});
test("rejects invalid IDs and staging limits", async () => {
  const state = setup([{ ...validPlan, plan: { ...validPlan.plan, campaignId: "bad" } }]);
  const result = await prepareStagingActionOutbox({ env, MongoClient: state.MongoClient });
  assert.equal(result.prepared, 0);
  await assert.rejects(prepareStagingActionOutbox({ env, MongoClient: state.MongoClient, limit: 51 }), /INVALID_LIMIT/);
});
test("refuses production database before connecting", async () => {
  const state = setup([validPlan]);
  await assert.rejects(prepareStagingActionOutbox({ env: { ...env, MONGODB_STAGING_DB: "automationDB" },
    MongoClient: state.MongoClient }), /STAGING_DATABASE_REQUIRED/);
  assert.equal(state.connected, 0);
});
