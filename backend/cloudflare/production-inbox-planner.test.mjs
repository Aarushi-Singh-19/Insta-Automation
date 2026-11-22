import test from "node:test";
import assert from "node:assert/strict";
import { resolveProductionComment, planProductionInbox } from "./production-inbox-planner.js";

const userId = "aaaaaaaaaaaaaaaaaaaaaaaa", campaignId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const ruleId = "cccccccccccccccccccccccc";
const event = { entryId: "123456", postId: "987654", eventId: "555555", commentText: "send guide" };
const item = { _id: "comment:1", userId, accountId: "123456", event };
const cursor = values => ({ sort() { return this; }, limit() { return this; }, async toArray() { return values; } });
test("production resolver fails closed for unmapped accounts", async () => {
  const db = { collection(name) {
    assert.equal(name, "instagramaccounts");
    return { find() { return cursor([]); } };
  } };
  assert.equal(await resolveProductionComment({ db, item }), null);
});
test("production resolver chooses first matching owned rule in campaign order", async () => {
  const db = { collection(name) {
    if (name === "instagramaccounts") return { find() { return cursor([{ userId }]); } };
    if (name === "campaigns") return { find() { return cursor([{
      _id: campaignId, ruleIds: [ruleId], userId, status: "active"
    }]); } };
    if (name === "rules") return { find() { return cursor([{
      _id: ruleId, userId, isActive: true, triggerType: "keyword",
      triggerKeywords: ["guide"]
    }]); } };
    throw new Error("Unexpected collection");
  } };
  const result = await resolveProductionComment({ db, item });
  assert.equal(String(result.rule._id), ruleId);
});
test("production planner rejects staging runtime before any DB access", async () => {
  await assert.rejects(
    planProductionInbox({ env: { TRIGGERDM_RUNTIME: "staging" },
      MongoClient: class { constructor() { throw new Error("unexpected DB connection"); } } }),
    /PRODUCTION_RUNTIME_REQUIRED/
  );
});
test("production planner requires explicit flag even with production configuration", async () => {
  await assert.rejects(planProductionInbox({
    env: { TRIGGERDM_RUNTIME: "production", PRODUCTION_CUTOVER_APPROVED: "true",
      MONGODB_PRODUCTION_DB: "automationDB",
      MONGODB_PRODUCTION_URI: "mongodb+srv://app:pass@cluster.example.net/automationDB" },
    MongoClient: class { constructor() { throw new Error("unexpected DB connection"); } }
  }), /PRODUCTION_PLANNER_DISABLED/);
});

test("production next-post claim is atomic and restricted to the webhook account owner", async () => {
  let claimed = false;
  const db = { collection(name) {
    if (name === "instagramaccounts") return { find() { return cursor([{ userId }]); } };
    if (name === "campaigns") return {
      find() { return cursor([]); },
      async findOneAndUpdate(filter, update, options) {
        assert.equal(String(filter.userId), userId);
        assert.equal(filter.$or[0].instagramAccountId, item.accountId);
        assert.equal(filter.triggerType, "next-post");
        assert.equal(options.returnDocument, "after");
        assert.deepEqual(update.$set.postIds, [event.postId]);
        claimed = true;
        return { _id: campaignId, ruleIds: [ruleId], userId, status: "active", ...update.$set };
      },
    };
    if (name === "rules") return { find() { return cursor([{
      _id: ruleId, userId, isActive: true, triggerType: "any_comment",
    }]); } };
    throw new Error("Unexpected collection");
  } };
  assert.equal(await resolveProductionComment({ db, item }), null);
  assert.equal(claimed, false);
  const result = await resolveProductionComment({ db, item, claimNextPost: true });
  assert.equal(result.campaign.triggerType, "specific-post");
  assert.equal(claimed, true);
});
