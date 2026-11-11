import test from "node:test";
import assert from "node:assert/strict";
import { inspectStagingSendSafety } from "./staging-send-safety.js";
const valid = {
  plan: { actionsNotAuthorized: true, eventId: "123", postId: "456", campaignId: "c", ruleId: "r" },
  reservation: { reserved: true, duplicate: false, reservationId: "res" },
  account: { isActive: true, ownerVerified: true, instagramAccountId: "987", accessTokenPresent: true },
  recipient: { id: "321", eligibleForPrivateReply: true },
  followGate: { verified: true, accountId: "987", recipientId: "321" }
};
test("even fully checked local state never authorizes sending", () => {
  const result = inspectStagingSendSafety(valid);
  assert.equal(result.passedLocalChecks, true);
  assert.equal(result.readyForExecution, false);
});
test("rejects missing reservation, duplicate reservation, wrong recipient, or mismatched follow gate", () => {
  for (const override of [
    { reservation: null },
    { reservation: { ...valid.reservation, duplicate: true } },
    { recipient: { ...valid.recipient, id: "987" } },
    { recipient: { ...valid.recipient, eligibleForPrivateReply: false } },
    { followGate: { ...valid.followGate, accountId: "wrong" } },
    { account: { ...valid.account, accessTokenPresent: false } },
    { plan: { ...valid.plan, actionsNotAuthorized: false } }
  ]) {
    const result = inspectStagingSendSafety({ ...valid, ...override });
    assert.equal(result.readyForExecution, false);
    assert.notEqual(result.passedLocalChecks, true);
  }
});
