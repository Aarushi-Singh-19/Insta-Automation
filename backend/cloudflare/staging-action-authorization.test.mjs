import test from "node:test";
import assert from "node:assert/strict";
import { authorizeStagingAction } from "./staging-action-authorization.js";
const userId = "507f1f77bcf86cd799439011";
const now = new Date("2026-11-11T12:00:00Z");
const user = { subscriptionStatus: "trial", trialEnd: "2026-11-12T00:00:00Z" };
const usage = { sent: 4, periodStart: "2026-11-10T00:00:00Z", periodEnd: "2026-11-12T00:00:00Z" };
const base = { user, usage, userId, actionId: "comment:123:dm", now };
test("unverified follow gate prevents quota reservation", async () => {
  let called = false;
  const result = await authorizeStagingAction({ ...base, reserveQuota: async () => { called = true; } });
  assert.equal(result.reason, "FOLLOW_GATE_NOT_VERIFIED");
  assert.equal(called, false);
});
test("expired trial prevents quota reservation", async () => {
  let called = false;
  const result = await authorizeStagingAction({ ...base, user: { ...user, trialEnd: "2026-11-10T00:00:00Z" }, followGateSatisfied: true, reserveQuota: async () => { called = true; } });
  assert.equal(result.authorized, false);
  assert.equal(called, false);
});
test("successful reservation is still not permission to send a DM", async () => {
  let args;
  const result = await authorizeStagingAction({ ...base, followGateSatisfied: true, reserveQuota: async input => {
    args = input;
    return { reserved: true, duplicate: false, reservationId: "reservation-1" };
  } });
  assert.equal(args.limit, 500);
  assert.equal(result.reservationConfirmed, true);
  assert.equal(result.authorized, false);
});
test("duplicate or failed reservations fail closed", async () => {
  for (const reservation of [
    { reserved: false, duplicate: true, reason: "ALREADY_RESERVED_RECONCILE_ACTION" },
    { reserved: true, duplicate: true, reservationId: "duplicate" },
    undefined
  ]) {
    const result = await authorizeStagingAction({ ...base, followGateSatisfied: true, reserveQuota: async () => reservation });
    assert.equal(result.authorized, false);
    assert.notEqual(result.reservationConfirmed, true);
  }
});
