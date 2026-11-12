import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { resolveStagingComment } from "./staging-comment-resolver.js";
import { planCommentAutomation } from "./comment-planner.js";

// Isolated in-memory fixture: no real MongoDB, Meta, Razorpay, or message sends.
test("staging comment resolves an owned account, campaign and ordered rule into an unauthorized action plan", async () => {
  const userId = new ObjectId(), campaignId = new ObjectId();
  const firstId = new ObjectId(), matchingId = new ObjectId();
  const comment = { entryId: "123456", eventId: "111222", postId: "789012", commentText: "Please send the LINK" };
  const account = { _id: new ObjectId(), userId, instagramBusinessId: comment.entryId };
  const campaign = { _id: campaignId, userId, instagramAccountId: comment.entryId, status: "active",
    triggerType: "specific-post", postIds: [comment.postId], ruleIds: [firstId, matchingId] };
  const rules = [
    { _id: firstId, userId, isActive: true, triggerType: "keyword", triggerKeywords: ["price"] },
    { _id: matchingId, userId, isActive: true, triggerType: "keyword", triggerKeywords: ["link"] }
  ];
  const cursor = rows => ({ project() { return this; }, limit() { return this; }, async toArray() { return rows; } });
  const db = { collection(name) {
    if (name === "instagramaccounts") return { find(query) {
      assert.equal(query.instagramBusinessId, comment.entryId);
      return cursor([account]);
    } };
    if (name === "campaigns") return { find(query) {
      assert.equal(String(query.userId), String(userId));
      assert.deepEqual(query.$or, [{ instagramAccountId: comment.entryId }, { instagramAccountId: "" }, { instagramAccountId: { $exists: false } }, { instagramAccountId: null }]);
      return cursor([campaign]);
    } };
    if (name === "rules") return { find(query) {
      assert.equal(String(query.userId), String(userId));
      assert.equal(query.isActive, true);
      return cursor(rules.filter(r => query._id.$in.some(id => String(id) === String(r._id))));
    } };
    throw new Error("unexpected collection " + name);
  } };
  const resolution = await resolveStagingComment({ db, comment });
  assert.equal(String(resolution.rule._id), String(matchingId));
  const decision = planCommentAutomation({ comment, ...resolution });
  assert.equal(decision.matched, true);
  assert.equal(decision.plan.eventId, comment.eventId);
  assert.equal(decision.plan.campaignId, String(campaignId));
  assert.equal(decision.plan.ruleId, String(matchingId));
  assert.equal(decision.plan.actionsNotAuthorized, true);
  assert.equal(decision.plan.requiresSubscriptionAndQuotaCheck, true);
  assert.equal(decision.plan.needsFollowGateEvaluation, true);
});
