import test from "node:test";
import assert from "node:assert/strict";
import { planCommentAutomation } from "./comment-planner.js";
const comment = { eventId: "123", postId: "456", commentText: "Please send TEST details" };
const campaign = { _id: "campaign-1", status: "active", triggerType: "specific-post", instagramMediaId: "456" };
const rule = { _id: "rule-1", isActive: true, triggerType: "keyword", triggerKeywords: ["test"] };
test("matches case-insensitive keywords only for selected post", () => {
  const result = planCommentAutomation({ comment, campaign, rule });
  assert.equal(result.matched, true);
  assert.equal(result.plan.actionsNotAuthorized, true);
  assert.equal(result.plan.needsFollowGateEvaluation, true);
  assert.equal(result.plan.requiresSubscriptionAndQuotaCheck, true);
});
test("never plans automation for wrong post, disabled rule or campaign", () => {
  assert.equal(planCommentAutomation({ comment: { ...comment, postId: "999" }, campaign, rule }).matched, false);
  assert.equal(planCommentAutomation({ comment, campaign, rule: { ...rule, isActive: false } }).matched, false);
  assert.equal(planCommentAutomation({ comment, campaign: { ...campaign, status: "paused" }, rule }).matched, false);
});
test("rejects unknown triggers rather than assuming all-posts", () => {
  assert.equal(planCommentAutomation({ comment, campaign: { ...campaign, triggerType: "surprise" }, rule }).matched, false);
  assert.equal(planCommentAutomation({ comment, campaign, rule: { ...rule, triggerType: "surprise" } }).matched, false);
});
test("all-comments rule can match without keywords", () => {
  const result = planCommentAutomation({ comment, campaign, rule: { ...rule, triggerType: "any_comment", triggerKeywords: [] } });
  assert.equal(result.matched, true);
});
test("keyword mismatch does not plan a DM", () => {
  assert.equal(planCommentAutomation({ comment, campaign, rule: { ...rule, triggerKeywords: ["pricing"] } }).matched, false);
});
