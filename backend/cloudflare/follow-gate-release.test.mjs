import test from "node:test";
import assert from "node:assert/strict";
import { verifiedFollowGateRelease } from "./follow-gate-release.js";
const args = { inboxId: "comment:123:456", campaignId: "a".repeat(24),
  userId: "b".repeat(24), recipientId: "789", commentId: "456" };
const session = { _id: "follow:comment:123:456", status: "VERIFIED", ...args };
test("verified session matching every identity may proceed to normal authorization", () => {
  assert.deepEqual(verifiedFollowGateRelease({ ...args, session }), { allowed: true });
});
test("missing or waiting session cannot release DM", () => {
  assert.equal(verifiedFollowGateRelease({ ...args, session: null }).allowed, false);
  assert.equal(verifiedFollowGateRelease({ ...args, session: { ...session, status: "WAITING" } }).allowed, false);
});
test("different owner, campaign, recipient, comment or inbox cannot release DM", () => {
  for (const [key, value] of Object.entries({
    userId: "c".repeat(24), campaignId: "d".repeat(24), recipientId: "999",
    commentId: "999", inboxId: "comment:123:999"
  })) {
    assert.equal(verifiedFollowGateRelease({ ...args, [key]: value, session }).allowed, false, key);
  }
});
test("forged verified session key and malformed inbox cannot release", () => {
  assert.equal(verifiedFollowGateRelease({ ...args, session: { ...session, _id: "follow:comment:999:456" } }).allowed, false);
  assert.equal(verifiedFollowGateRelease({ ...args, inboxId: "invalid", session: { ...session, inboxId: "invalid", _id: "follow:invalid" } }).allowed, false);
});
