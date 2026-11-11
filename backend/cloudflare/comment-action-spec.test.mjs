import test from "node:test";
import assert from "node:assert/strict";
import { buildCommentActionSpec } from "./comment-action-spec.js";
const comment = { eventId: "123", entryId: "999" };
const campaign = { status: "active", settings: { enableDM: true, enableReply: true, dmMessage: "Thanks!" } };
const rule = { isActive: true, replies: ["check your dm", "sent"] };
const build = overrides => buildCommentActionSpec({ comment, campaign, rule, ...overrides });
test("plans reply and comment-triggered DM without authorizing sends", () => {
  const result = build();
  assert.equal(result.ready, true);
  assert.equal(result.spec.dm.message, "Thanks!");
  assert.equal(result.spec.authorized, false);
  assert.equal(result.spec.requiresAtomicQuotaReservation, true);
  assert.equal(result.spec.reply.message, build().spec.reply.message);
});
test("respects per-campaign reply and DM toggles", () => {
  const result = build({ campaign: { ...campaign, settings: { enableDM: false, enableReply: true } } });
  assert.equal(result.ready, true);
  assert.equal(result.spec.dm, null);
  assert.equal(result.spec.requiresAtomicQuotaReservation, false);
  assert.equal(build({ campaign: { ...campaign, settings: { enableDM: false, enableReply: false } } }).ready, false);
});
test("requires Follow Gate workflow when configured", () => {
  const result = build({ campaign: { ...campaign, gate: { gateType: "FOLLOW", status: "enabled" } } });
  assert.equal(result.spec.followGateRequired, true);
});
test("fails closed on missing DM text and malformed buttons", () => {
  assert.equal(build({ campaign: { ...campaign, settings: { enableDM: true, dmMessage: "" } } }).reason, "DM_MESSAGE_MISSING");
  assert.equal(build({ campaign: { ...campaign, settings: { ...campaign.settings, dmButtons: [{ title: "Bad", url: "http://example.com" }] } } }).reason, "INVALID_DM_BUTTONS");
});
test("fails closed for inactive rule and invalid comment ID", () => {
  assert.equal(build({ rule: { ...rule, isActive: false } }).ready, false);
  assert.equal(build({ comment: { ...comment, eventId: "invalid" } }).ready, false);
});
