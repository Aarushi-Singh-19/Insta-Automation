import test from "node:test";
import assert from "node:assert/strict";
import { processStagingFollowPostbacks } from "./staging-follow-postback-processor.js";
const env = { MONGODB_STAGING_DB: "triggerdm_staging",
  MONGODB_STAGING_URI: "mongodb://localhost:27017/triggerdm_staging",
  ENABLE_STAGING_FOLLOW_POSTBACK_PROCESSOR: "true", ENABLE_STAGING_FOLLOW_VERIFICATION: "true" };
test("postback processor stays off by default", async () => {
  assert.deepEqual(await processStagingFollowPostbacks({ env: { ...env, ENABLE_STAGING_FOLLOW_POSTBACK_PROCESSOR: "false" } }), { skipped: "disabled" });
});
test("requires isolated DB and Meta verification flag", async () => {
  await assert.rejects(processStagingFollowPostbacks({ env: { ...env, MONGODB_STAGING_DB: "automationDB" } }), /STAGING_DATABASE_REQUIRED/);
  await assert.rejects(processStagingFollowPostbacks({ env: { ...env, ENABLE_STAGING_FOLLOW_VERIFICATION: "false" } }), /FOLLOW_VERIFICATION_DISABLED/);
});
test("claims one postback and records verification without sending DMs", async () => {
  const updates = [];
  let claimed = false;
  class MongoClient {
    async connect() {}
    db(name) { assert.equal(name, "triggerdm_staging"); return { collection(name) {
      assert.equal(name, "cloudflare_staging_webhook_inbox");
      return {
        async findOneAndUpdate(query, update) {
          assert.equal(query.kind, "postback"); assert.equal(query.status, "pending");
          assert.equal(update.$set.status, "verifying");
          if (claimed) return null;
          claimed = true;
          return { _id: "postback:one", event: { senderId: "456" } };
        },
        async updateOne(query, update) { updates.push({ query, update }); return { modifiedCount: 1 }; }
      };
    } }; }
    async close() {}
  }
  const result = await processStagingFollowPostbacks({ env, MongoClient, fetchImpl: async () => {},
    verify: async ({ postback }) => { assert.equal(postback.senderId, "456"); return { unlocked: true }; } });
  assert.deepEqual(result, { inspected: 1, verified: 1, held: 0, instagramMessagesSent: 0 });
  assert.equal(updates[0].update.$set.status, "verified");
  assert.equal(updates[0].query.status, "verifying");
});
test("provider failures remain held for review, never assumed verified", async () => {
  const updates = [];
  let once = false;
  class MongoClient {
    async connect() {}
    db() { return { collection() { return {
      async findOneAndUpdate() { if (once) return null; once = true; return { _id: "postback:two", event: {} }; },
      async updateOne(_, update) { updates.push(update); }
    }; } }; }
    async close() {}
  }
  const result = await processStagingFollowPostbacks({ env, MongoClient, fetchImpl: async () => {},
    verify: async () => { throw new Error("Meta timeout"); } });
  assert.equal(result.held, 1);
  assert.equal(updates[0].$set.status, "needs_review");
});
