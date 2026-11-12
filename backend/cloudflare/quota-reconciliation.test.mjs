import test from "node:test";
import assert from "node:assert/strict";
import { verifiedQuotaState } from "./quota-reconciliation.js";
const period = { period: "billing", limit: 10000 };
const counter = { userId: "abc", period: "billing", limit: 10000, baselineVerified: true,
  baselineSource: "render-reconciliation", baselineSent: 400, reserved: 25 };
test("includes existing Render usage in quota", () => {
  assert.deepEqual(verifiedQuotaState(counter, period, "abc"), { sent: 425, remaining: 9575 });
});
test("missing or unverified baseline blocks sends", () => {
  assert.equal(verifiedQuotaState(null, period, "abc"), null);
  assert.equal(verifiedQuotaState({ ...counter, baselineVerified: false }, period, "abc"), null);
  assert.equal(verifiedQuotaState({ ...counter, baselineSource: "unknown" }, period, "abc"), null);
});
test("rejects wrong owner, period, and quota", () => {
  assert.equal(verifiedQuotaState(counter, period, "other"), null);
  assert.equal(verifiedQuotaState({ ...counter, period: "trial" }, period, "abc"), null);
  assert.equal(verifiedQuotaState({ ...counter, limit: 500 }, period, "abc"), null);
});
test("rejects corrupt or excessive counters", () => {
  for (const change of [{ baselineSent: -1 }, { reserved: -1 }, { reserved: 0.5 },
    { baselineSent: 9999, reserved: 2 }, { baselineSent: NaN }]) {
    assert.equal(verifiedQuotaState({ ...counter, ...change }, period, "abc"), null);
  }
});
