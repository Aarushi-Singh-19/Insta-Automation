import test from "node:test";
import assert from "node:assert/strict";
import { authorizeCommentActions } from "./automation-authorization.js";
const now = new Date("2026-11-11T12:00:00Z");
const user = { _id: "u1", subscriptionStatus: "active", planEndDate: "2026-12-01T00:00:00Z" };
const campaign = { userId: "u1", status: "active", gate: { gateType: "NONE" } };
const rule = { userId: "u1", isActive: true };
const account = { userId: "u1", status: "active" };
const usage = { period: "billing", sent: 0 };
const check = overrides => authorizeCommentActions({ user, campaign, rule, account, usage, now, ...overrides });
test("paid subscription can proceed only with atomic reservation and deduplication", () => {
  const result = check();
  assert.equal(result.authorized, true);
  assert.equal(result.remainingBeforeSend, 10000);
  assert.equal(result.requiresAtomicReservation, true);
  assert.equal(result.requiresDurableDeduplication, true);
});
test("trial quota is 500 and paid quota is 10000", () => {
  const trial = { ...user, subscriptionStatus: "trial", trialEndDate: "2026-11-12T00:00:00Z" };
  assert.equal(check({ user: trial, usage: { period: "trial", sent: 499 } }).authorized, true);
  assert.equal(check({ user: trial, usage: { period: "trial", sent: 500 } }).reason, "DM_QUOTA_EXHAUSTED");
  assert.equal(check({ usage: { period: "billing", sent: 10000 } }).reason, "DM_QUOTA_EXHAUSTED");
});
test("expired subscriptions and unknown usage fail closed", () => {
  assert.equal(check({ user: { ...user, planEndDate: "2026-11-01T00:00:00Z" } }).reason, "SUBSCRIPTION_INACTIVE");
  assert.equal(check({ usage: { period: "billing", sent: -1 } }).reason, "USAGE_UNVERIFIED");
  assert.equal(check({ usage: { period: "trial", sent: 0 } }).reason, "USAGE_UNVERIFIED");
});
test("rejects cross-account execution and disabled rules", () => {
  assert.equal(check({ account: { ...account, userId: "other" } }).reason, "OWNER_MISMATCH");
  assert.equal(check({ rule: { ...rule, isActive: false } }).reason, "INACTIVE_AUTOMATION");
});
test("does not bypass enabled Follow Gate", () => {
  assert.equal(check({ campaign: { ...campaign, gate: { gateType: "FOLLOW", status: "enabled" } } }).reason, "FOLLOW_GATE_REQUIRED");
});
