import test from "node:test";
import assert from "node:assert/strict";
import { consumeActionBatch, validateActionJob, enqueueAction } from "./action-queue.js";

const job = { name: "process-comment", data: {
  commentId: "c1", userId: "u1", campaignId: "ca1", ruleId: "r1",
  action: { type: "send_dm" }
} };
function message(body = job) {
  return { body, ackCount: 0, retryCount: 0,
    ack() { this.ackCount++; }, retry() { this.retryCount++; } };
}

test("does not acknowledge queued Instagram actions without an executor", async () => {
  const m = message();
  const result = await consumeActionBatch({ messages: [m] });
  assert.equal(result[0].status, "retry");
  assert.equal(m.ackCount, 0);
  assert.equal(m.retryCount, 1);
});

test("does not acknowledge ambiguous or non-durable executor results", async () => {
  const m = message();
  await consumeActionBatch({ messages: [m] }, async () => ({ ok: true }));
  assert.equal(m.ackCount, 0);
  assert.equal(m.retryCount, 1);
});

test("acknowledges only explicitly durable execution", async () => {
  const m = message();
  await consumeActionBatch({ messages: [m] }, async () => ({ durable: true }));
  assert.equal(m.ackCount, 1);
  assert.equal(m.retryCount, 0);
});

test("retries invalid jobs without executing them", async () => {
  const m = message({ name: "unexpected", data: {} });
  let executed = false;
  await consumeActionBatch({ messages: [m] }, async () => { executed = true; });
  assert.equal(executed, false);
  assert.equal(m.ackCount, 0);
  assert.equal(m.retryCount, 1);
});

test("validates action types before enqueue", async () => {
  assert.throws(() => validateActionJob({ ...job, data: { ...job.data, action: { type: "unknown" } } }), /Invalid comment action/);
  let queued;
  const result = await enqueueAction({ send: async x => { queued = x; } }, job);
  assert.equal(result.queued, true);
  assert.equal(queued.name, "process-comment");
});

test("retries executor exceptions without acknowledging", async () => {
  const m = message();
  await consumeActionBatch({ messages: [m] }, async () => { throw new Error("temporary outage"); });
  assert.equal(m.ackCount, 0);
  assert.equal(m.retryCount, 1);
});
