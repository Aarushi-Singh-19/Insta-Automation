import test from "node:test";
import assert from "node:assert/strict";
import { executeStagingActions } from "./staging-action-executor.js";
import { ObjectId } from "mongodb";

test("Follow Gate prompts once, waits for verified session, then resumes content DM", async () => {
  const owner = new ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa");
  const campaignId = new ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb");
  const ruleId = new ObjectId("cccccccccccccccccccccccc");
  const itemId = "comment:123:456";
  const now = new Date("2026-11-12T12:00:00Z");
  const event = { entryId: "123", eventId: "456", postId: "555", recipientId: "789", commentText: "guide" };
  const plan = { eventId: "456", postId: "555", campaignId: String(campaignId), ruleId: String(ruleId) };
  const campaign = { _id: campaignId, userId: owner, status: "active", ruleIds: [ruleId],
    triggerType: "specific-post", instagramMediaId: "555", settings: {
      enableReply: true, enableDM: true, dmMessage: "Here is your guide"
    }, gate: { gateType: "FOLLOW", status: "enabled" } };
  const rule = { _id: ruleId, userId: owner, isActive: true, triggerType: "keyword",
    keywords: ["guide"], replies: ["Check your DM"] };
  const account = { userId: owner, instagramBusinessId: "123", status: "active",
    username: "staging_test", accessToken: "reply-token", pageAccessToken: "dm-token" };
  const user = { _id: owner, subscriptionStatus: "trial",
    trialStartDate: new Date("2026-11-10"), trialEndDate: new Date("2026-11-20") };
  const quota = { userId: owner, period: "trial", limit: 500, baselineVerified: true,
    baselineSource: "render-reconciliation", baselineSent: 0, reserved: 0 };
  const outbox = { _id: itemId, plan, status: "awaiting_authorization", authorized: false };
  const sends = new Map();
  let session = null;
  const calls = [];
  const collections = {
    cloudflare_staging_action_outbox: {
      find() { return { sort() { return this; }, limit() { return this; },
        async *[Symbol.asyncIterator]() { if (outbox.status !== "completed") yield { ...outbox }; } }; },
      async updateOne(filter, update) {
        if (outbox.status !== filter.status) return { modifiedCount: 0 };
        Object.assign(outbox, update.$set); return { modifiedCount: 1 };
      }
    },
    cloudflare_staging_action_sends: {
      async findOne({ _id }) { return sends.get(_id) || null; },
      async insertOne(row) { if (sends.has(row._id)) throw Object.assign(new Error("duplicate"), { code: 11000 }); sends.set(row._id, row); },
      async updateOne(filter, update) { const row = sends.get(filter._id); if (row) Object.assign(row, update.$set); return { modifiedCount: row ? 1 : 0 }; }
    },
    cloudflare_staging_dm_quotas: {
      async findOne() { return { ...quota }; },
      async updateOne(filter, update) {
        if (filter.reserved?.$lte < quota.reserved) return { modifiedCount: 0 };
        quota.reserved += update.$inc.reserved; return { modifiedCount: 1 };
      }
    },
    cloudflare_staging_webhook_inbox: { async findOne() { return { _id: itemId, status: "planned", event }; } },
    campaigns: { async findOne() { return campaign; } },
    rules: { async findOne() { return rule; } },
    instagramaccounts: { async findOne() { return account; } },
    users: { async findOne() { return user; } },
    cloudflare_staging_follow_gate_sessions: {
      async findOne() { return session; },
      async updateOne(_filter, update) {
        if (session) return { upsertedCount: 0 };
        session = { ...update.$setOnInsert }; return { upsertedCount: 1 };
      }
    }
  };
  class MongoClient {
    async connect() {}
    db(name) { assert.equal(name, "triggerdm_staging"); return { collection(name) {
      assert.ok(collections[name], "unexpected collection: " + name); return collections[name];
    } }; }
    async close() {}
  }
  const env = { MONGODB_STAGING_DB: "triggerdm_staging",
    MONGODB_STAGING_URI: "mongodb://localhost:27017/triggerdm_staging",
    ENABLE_STAGING_INSTAGRAM_SEND: "true" };
  const fetchImpl = async (url, options) => {
    if (url.endsWith("/replies")) { calls.push("reply"); return { ok: true, json: async () => ({ id: "reply-id" }) }; }
    const payload = JSON.parse(options.body);
    if (payload.message.attachment) {
      calls.push("gate_prompt");
      assert.equal(payload.recipient.comment_id, "456");
      assert.equal(payload.message.attachment.payload.buttons[1].payload, "VERIFY:follow:comment:123:456");
    } else {
      calls.push("content_dm");
      assert.equal(payload.recipient.id, "789");
    }
    return { ok: true, json: async () => ({ message_id: "dm-id" }) };
  };
  const args = { env, MongoClient, fetchImpl, now,
    getFollower: async () => ({ followsBusiness: false }) };
  const first = await executeStagingActions(args);
  assert.equal(first.completed, 1);
  assert.equal(outbox.status, "awaiting_follow");
  assert.equal(session.status, "WAITING");
  assert.deepEqual(calls, ["reply", "gate_prompt"]);
  assert.equal(quota.reserved, 1);
  const waiting = await executeStagingActions(args);
  assert.equal(waiting.blocked, 1);
  assert.deepEqual(calls, ["reply", "gate_prompt"]);
  session.status = "VERIFIED";
  const resumed = await executeStagingActions(args);
  assert.equal(resumed.completed, 1);
  assert.equal(outbox.status, "completed");
  assert.deepEqual(calls, ["reply", "gate_prompt", "content_dm"]);
  assert.equal(quota.reserved, 2);
  const replay = await executeStagingActions(args);
  assert.equal(replay.completed, 0);
  assert.equal(calls.length, 3);
});
