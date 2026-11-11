import test from "node:test";
import assert from "node:assert/strict";
import { followGateDecision, startFollowGate, confirmFollowGate } from "./follow-gate-state.js";
test("only verified followers bypass the enabled gate", () => {
  const gate = { gateType: "FOLLOW", status: "enabled" };
  assert.equal(followGateDecision({ gate, followerStatus: true }).action, "deliver");
  assert.equal(followGateDecision({ gate, followerStatus: false }).action, "request_follow");
  assert.equal(followGateDecision({ gate }).action, "hold");
  assert.equal(followGateDecision({ gate: { gateType: "NONE" } }).action, "deliver");
});
test("follow sessions are keyed by inbox event and idempotent", async () => {
  const sessions = new Map();
  const db = { collection(name) {
    assert.equal(name, "cloudflare_staging_follow_gate_sessions");
    return { async updateOne(query, update) {
      if (sessions.has(query._id)) return { upsertedCount: 0 };
      sessions.set(query._id, update.$setOnInsert);
      return { upsertedCount: 1 };
    } };
  } };
  const args = { db, inboxId: "comment:999:123", campaignId: "a".repeat(24),
    userId: "b".repeat(24), recipientId: "123", commentId: "456" };
  assert.equal((await startFollowGate(args)).created, true);
  assert.equal((await startFollowGate(args)).created, false);
  assert.equal(sessions.size, 1);
});
test("follow verification requires positive provider status and one-time claim", async () => {
  let status = "WAITING";
  const db = { collection() { return { async findOneAndUpdate(query) {
    if (status !== query.status) return null;
    status = "VERIFIED"; return { _id: query._id };
  } }; } };
  const args = { db, sessionId: "follow:comment:999:123" };
  assert.equal((await confirmFollowGate({ ...args, followerStatus: false })).unlocked, false);
  assert.equal((await confirmFollowGate({ ...args, followerStatus: true })).unlocked, true);
  assert.equal((await confirmFollowGate({ ...args, followerStatus: true })).unlocked, false);
});
