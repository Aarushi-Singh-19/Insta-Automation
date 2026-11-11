import test from "node:test";
import assert from "node:assert/strict";
import { validateActionJob, enqueueAction, consumeActionBatch } from "./action-queue.js";

const base = { commentId: "comment-1", userId: "user-1", campaignId: "campaign-1", ruleId: "rule-1" };
const commentJob = (type = "send_dm") => ({ name: "process-comment", data: { ...base, action: { type, message: "hello" } } });
const gateJob = () => ({ name: "process-gate-resume", data: { ...base, isGateResume: true, actions: [{ type: "reply" }, { type: "send_dm" }] } });
const msg = (body) => ({ body, acked: 0, retried: 0, ack() { this.acked++; }, retry() { this.retried++; } });

test("accepts comment reply and DM jobs", () => {
  assert.equal(validateActionJob(commentJob("reply")).name, "process-comment");
  assert.equal(validateActionJob(commentJob("send_dm")).name, "process-comment");
});
test("accepts sequential Follow Gate resume payload", () => {
  assert.equal(validateActionJob(gateJob()).data.actions.length, 2);
});
test("rejects invalid actions and missing identifiers", () => {
  assert.throws(() => validateActionJob(commentJob("charge_card")));
  assert.throws(() => validateActionJob({ name: "process-comment", data: { action: { type: "reply" } } }));
  assert.throws(() => validateActionJob({ ...gateJob(), data: { ...base, actions: [{ type: "send_dm" }] } }));
});
test("producer sends only valid jobs", async () => {
  const sent = [];
  await enqueueAction({ send: async (body) => sent.push(body) }, commentJob());
  assert.equal(sent.length, 1);
  assert.equal(sent[0].data.commentId, base.commentId);
  await assert.rejects(() => enqueueAction({ send: async () => sent.push(1) }, { name: "bad", data: base }));
  assert.equal(sent.length, 1);
});
test("consumer retries every message when executor is absent", async () => {
  const a = msg(commentJob()); const b = msg(gateJob());
  const results = await consumeActionBatch({ messages: [a, b] });
  assert.deepEqual(results.map(x => x.status), ["retry", "retry"]);
  assert.equal(a.acked + b.acked, 0);
  assert.equal(a.retried + b.retried, 2);
});
test("consumer acknowledges only durable results", async () => {
  const a = msg(commentJob()); const b = msg(gateJob());
  const results = await consumeActionBatch({ messages: [a, b] }, async job =>
    job.name === "process-comment" ? { durable: true } : { durable: false });
  assert.deepEqual(results.map(x => x.status), ["ack", "retry"]);
  assert.equal(a.acked, 1); assert.equal(a.retried, 0);
  assert.equal(b.acked, 0); assert.equal(b.retried, 1);
});
test("consumer retries executor errors and malformed messages", async () => {
  const a = msg(commentJob()); const b = msg({ name: "unknown", data: base });
  await consumeActionBatch({ messages: [a, b] }, async () => { throw new Error("temporary outage"); });
  assert.equal(a.retried, 1); assert.equal(b.retried, 1);
  assert.equal(a.acked + b.acked, 0);
});
