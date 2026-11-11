import test from "node:test";
import assert from "node:assert/strict";
import { planCommentAutomation } from "./comment-planner.js";

const comment = { eventId: "101", postId: "202", commentText: "Please TEST this" };
const campaign = { _id: "campaign1", status: "active", triggerType: "specific-post", postIds: ["202"] };
const rule = { _id: "rule1", isActive: true, triggerType: "keyword", triggerKeywords: ["test"] };

test("plans matching comments but never authorizes message sending", () => {
  const result = planCommentAutomation({ comment, campaign, rule });
  assert.equal(result.matched, true);
  assert.equal(result.plan.eventId, "101");
  assert.equal(result.plan.actionsNotAuthorized, true);
  assert.equal(result.plan.requiresSubscriptionAndQuotaCheck, true);
  assert.equal(result.plan.needsFollowGateEvaluation, true);
});

test("does not plan inactive campaigns or rules", () => {
  assert.equal(planCommentAutomation({ comment, campaign: { ...campaign, status: "paused" }, rule }).matched, false);
  assert.equal(planCommentAutomation({ comment, campaign, rule: { ...rule, isActive: false } }).matched, false);
});

test("does not plan comments from another post", () => {
  const result = planCommentAutomation({ comment: { ...comment, postId: "203" }, campaign, rule });
  assert.deepEqual(result, { matched: false, reason: "WRONG_POST" });
});

test("keyword matching ignores case and rejects unmatched comments", () => {
  assert.equal(planCommentAutomation({ comment, campaign, rule }).matched, true);
  assert.equal(planCommentAutomation({ comment: { ...comment, commentText: "hello" }, campaign, rule }).reason, "KEYWORD_MISMATCH");
});

test("any-comment rule matches without keywords", () => {
  const result = planCommentAutomation({ comment, campaign, rule: { ...rule, triggerType: "any_comment", triggerKeywords: [] } });
  assert.equal(result.matched, true);
});

test("fails closed on unsupported campaign and rule triggers", () => {
  assert.equal(planCommentAutomation({ comment, campaign: { ...campaign, triggerType: "unknown" }, rule }).matched, false);
  assert.equal(planCommentAutomation({ comment, campaign, rule: { ...rule, triggerType: "unsupported" } }).matched, false);
});

test("matches the production TriggerDM keywords field", () => {
  const result = planCommentAutomation({ comment, campaign, rule: { ...rule, triggerKeywords: undefined, keywords: ["TEST"] } });
  assert.equal(result.matched, true);
  assert.equal(result.plan.actionsNotAuthorized, true);
});
