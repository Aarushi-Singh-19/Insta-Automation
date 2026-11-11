import test from "node:test";
import assert from "node:assert/strict";
import { planPendingInbox } from "./staging-inbox-planner.js";

const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb://localhost:27017/triggerdm_staging" };
const comment = { eventId: "101", entryId: "999", postId: "202", commentText: "test" };
function fakeMongo() {
  const item = { _id: "comment:999:101", status: "pending", kind: "comment", event: comment };
  const plans = new Map();
  const inbox = {
    async findOneAndUpdate(filter, update) {
      if (item.status !== filter.status || item.kind !== filter.kind) return null;
      item.status = update.$set.status;
      return { ...item };
    },
    async updateOne(filter, update) {
      if (item._id !== filter._id || item.status !== filter.status) return { matchedCount: 0 };
      Object.assign(item, update.$set);
      return { matchedCount: 1 };
    }
  };
  const planCollection = { async updateOne(filter, update) {
    if (!plans.has(filter._id)) plans.set(filter._id, update.$setOnInsert);
    return { upsertedCount: 1 };
  } };
  class MongoClient {
    async connect() {}
    db(name) {
      assert.equal(name, "triggerdm_staging");
      return { collection: name => name === "cloudflare_staging_webhook_inbox" ? inbox : planCollection };
    }
    async close() {}
  }
  return { MongoClient, item, plans };
}
const matched = async () => ({
  campaign: { _id: "ca1", status: "active", triggerType: "specific-post", postIds: ["202"] },
  rule: { _id: "r1", isActive: true, triggerType: "keyword", triggerKeywords: ["test"] }
});

test("staging planner creates an authorization-required plan, never a DM", async () => {
  const { MongoClient, item, plans } = fakeMongo();
  const result = await planPendingInbox({ env, MongoClient, resolveCampaignAndRule: matched });
  assert.equal(result.processed, 1);
  assert.equal(item.status, "planned");
  assert.equal(plans.size, 1);
  assert.equal(plans.get(item._id).status, "awaiting_authorization");
  assert.equal(plans.get(item._id).plan.actionsNotAuthorized, true);
});

test("staging planner ignores unmatched comments without creating a plan", async () => {
  const { MongoClient, item, plans } = fakeMongo();
  const result = await planPendingInbox({ env, MongoClient, resolveCampaignAndRule: async () => null });
  assert.equal(result.processed, 1);
  assert.equal(item.status, "ignored");
  assert.equal(plans.size, 0);
});

test("staging planner marks failures for review instead of retrying blindly", async () => {
  const { MongoClient, item, plans } = fakeMongo();
  await assert.rejects(planPendingInbox({ env, MongoClient,
    resolveCampaignAndRule: async () => { throw new Error("database mismatch"); }
  }), /database mismatch/);
  assert.equal(item.status, "needs_review");
  assert.equal(plans.size, 0);
});

test("staging planner rejects invalid limits and production database", async () => {
  const { MongoClient } = fakeMongo();
  await assert.rejects(planPendingInbox({ env, MongoClient, limit: 51 }), /INVALID_LIMIT/);
  await assert.rejects(planPendingInbox({ env: { ...env, MONGODB_STAGING_DB: "automationDB" }, MongoClient }), /STAGING_DATABASE_REQUIRED/);
});
