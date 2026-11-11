import test from "node:test";
import assert from "node:assert/strict";
import { createActionExecutor } from "./action-executor.js";
import { consumeActionBatch } from "./action-queue.js";

const base = { commentId: "c1", campaignId: "campaign1", ruleId: "rule1", userId: "user1", username: "visitor", recipientId: "visitor-id" };
const job = (action = { type: "send_dm", message: "Hello" }) => ({ name: "process-comment", data: { ...base, action } });
function fixture(overrides = {}) {
  const calls = [];
  const deps = {
    getSubscriptionAccess: async () => ({ user: { id: "user1" }, hasAccess: true }),
    claimAction: async () => ({ state: "claimed" }),
    getInstagramAccount: async () => ({ username: "owner", instagramBusinessId: "owner-id" }),
    executeAction: async action => { calls.push(action.type); },
    markSuccess: async () => true,
    markFailure: async () => true,
    ...overrides,
  };
  return { calls, execute: createActionExecutor(deps) };
}
function message(body) {
  return { body, acked: 0, retried: 0, ack() { this.acked++; }, retry() { this.retried++; } };
}

test("acknowledges successful action only after durable record", async () => {
  const { calls, execute } = fixture(); const m = message(job());
  await consumeActionBatch({ messages: [m] }, execute);
  assert.deepEqual(calls, ["send_dm"]);
  assert.equal(m.acked, 1); assert.equal(m.retried, 0);
});
test("does not resend previously successful actions", async () => {
  const { calls, execute } = fixture({ claimAction: async () => ({ state: "success" }) });
  assert.deepEqual(await execute(job()), { durable: true });
  assert.deepEqual(calls, []);
});
test("subscription denied never executes an action", async () => {
  const { calls, execute } = fixture({ getSubscriptionAccess: async () => ({ user: {}, hasAccess: false }) });
  await assert.rejects(execute(job()), /SUBSCRIPTION_ACCESS_DENIED/);
  assert.deepEqual(calls, []);
});
test("self-authored comment is not replied to or messaged", async () => {
  const { calls, execute } = fixture();
  assert.deepEqual(await execute({ ...job(), data: { ...job().data, username: "owner" } }), { durable: true });
  assert.deepEqual(calls, []);
});
test("Follow Gate actions execute in sequence", async () => {
  const { calls, execute } = fixture();
  await execute({ name: "process-gate-resume", data: { ...base, isGateResume: true, actions: [{ type: "reply" }, { type: "send_dm" }] } });
  assert.deepEqual(calls, ["reply", "send_dm"]);
});
test("execution failure records failure and retries message", async () => {
  let failures = 0;
  const { execute } = fixture({ executeAction: async () => { throw new Error("Instagram unavailable"); }, markFailure: async () => { failures++; } });
  const m = message(job());
  await consumeActionBatch({ messages: [m] }, execute);
  assert.equal(failures, 1); assert.equal(m.retried, 1); assert.equal(m.acked, 0);
});
test("missing durable success cannot acknowledge message", async () => {
  const { execute } = fixture({ markSuccess: async () => false }); const m = message(job());
  await consumeActionBatch({ messages: [m] }, execute);
  assert.equal(m.acked, 0); assert.equal(m.retried, 1);
});
test("rejects missing integration dependencies", () => {
  assert.throws(() => createActionExecutor({}), /Missing executor dependency/);
});

test("Follow Gate passes resume context to DM service", async () => {
  const contexts = [];
  const { execute } = fixture({ executeAction: async (_action, context) => { contexts.push(context); } });
  await execute({ name: "process-gate-resume", data: { ...base, isGateResume: true, actions: [{ type: "send_dm", recipientId: "recipient-1", message: "Done" }] } });
  assert.equal(contexts[0].isGateResume, true);
});
test("Follow Gate skips messaging own account by action recipient ID", async () => {
  const { calls, execute } = fixture();
  await execute({ name: "process-gate-resume", data: { ...base, isGateResume: true, actions: [{ type: "send_dm", recipientId: "owner-id", message: "Done" }] } });
  assert.deepEqual(calls, []);
});
