import test from "node:test";
import assert from "node:assert/strict";
import { checkAutomationEntitlement } from "./entitlement-preflight.js";
const now = new Date("2026-11-11T12:00:00Z");
const usage = { sent: 499, periodStart: "2026-11-10T00:00:00Z", periodEnd: "2026-11-12T00:00:00Z" };
test("trial has 500 DM limit but preflight never authorizes a send", () => {
  const result = checkAutomationEntitlement({ user: { subscriptionStatus: "trial", trialEnd: "2026-11-12T00:00:00Z" }, usage, now });
  assert.equal(result.eligible, true);
  assert.equal(result.remaining, 1);
  assert.equal(result.sendAuthorized, false);
  assert.equal(result.requiresAtomicReservation, true);
});
test("paid subscription has 10000 DM limit", () => {
  const result = checkAutomationEntitlement({ user: { subscriptionStatus: "active", planEndDate: "2026-11-12T00:00:00Z" }, usage: { ...usage, sent: 9999 }, now });
  assert.equal(result.remaining, 1);
});
test("rejects expired, cancelled, exhausted, missing or unverifiable usage", () => {
  const user = { subscriptionStatus: "trial", trialEnd: "2026-11-12T00:00:00Z" };
  for (const data of [
    { user: { ...user, subscriptionStatus: "cancelled" }, usage },
    { user: { ...user, trialEnd: "2026-11-10T00:00:00Z" }, usage },
    { user, usage: { ...usage, sent: 500 } },
    { user, usage: { ...usage, sent: -1 } },
    { user, usage: { ...usage, periodStart: "" } },
    { user, usage: { ...usage, periodEnd: "2026-11-13T00:00:00Z" } },
    { user, usage: null }
  ]) assert.equal(checkAutomationEntitlement({ ...data, now }).eligible, false);
});
