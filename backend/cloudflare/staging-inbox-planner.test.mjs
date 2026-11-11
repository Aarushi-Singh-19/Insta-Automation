import test from "node:test";
import assert from "node:assert/strict";
import { planPendingInbox } from "./staging-inbox-planner.js";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb+srv://user:pass@cluster.example.net/triggerdm_staging" };
test("atomically claims comment, persists plan, never executes Instagram action", async () => {
  const calls = [];
  let closed = false, consumed = false;
  const item = { _id: "comment:123", event: { eventId: "123", postId: "456", commentText: "test" } };
  const inbox = {
    async findOneAndUpdate(filter, update) {
      calls.push(["claim", filter.status, update.$set.status]);
      if (consumed) return null;
      consumed = true;
      return item;
    },
    async updateOne(filter, update) { calls.push(["finish", filter.status, update.$set.status]); return { matchedCount: 1 }; }
  };
  const plans = {
    async updateOne(filter, update, options) {
      calls.push(["plan", filter._id, update.$setOnInsert.status]);
      assert.equal(options.upsert, true);
    }
  };
  class Client {
    async connect() {}
    db(name) { assert.equal(name, "triggerdm_staging"); return { collection: key => {
      if (key === "cloudflare_staging_webhook_inbox") return inbox;
      if (key === "cloudflare_staging_action_plans") return plans;
      throw new Error("unexpected collection");
    } }; }
    async close() { closed = true; }
  }
  const result = await planPendingInbox({ env, MongoClient: Client, resolveCampaignAndRule: async () => ({
    campaign: { _id: "campaign", status: "active", triggerType: "specific-post", instagramMediaId: "456" },
    rule: { _id: "rule", isActive: true, triggerType: "keyword", keywords: ["test"] }
  }) });
  assert.equal(result.processed, 1);
  assert.deepEqual(calls, [
    ["claim", "pending", "planning"],
    ["plan", "comment:123", "awaiting_authorization"],
    ["finish", "planning", "planned"],
    ["claim", "pending", "planning"]
  ]);
  assert.equal(closed, true);
});
test("rejects missing resolver and excessive batch size", async () => {
  await assert.rejects(planPendingInbox({ env, MongoClient: class {}, limit: 51, resolveCampaignAndRule: async () => null }), /INVALID_LIMIT/);
  await assert.rejects(planPendingInbox({ env, MongoClient: null }), /MongoClient required/);
});
