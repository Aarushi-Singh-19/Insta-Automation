import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

const fakeEnv = { VERIFY_TOKEN: "verify-test" };
test("health endpoint identifies probe-only runtime", async () => {
  const response = await worker.fetch(new Request("https://example.workers.dev/__cloudflare/health"), fakeEnv);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).mode, "probe-only");
});
test("Instagram verification accepts only configured challenge token", async () => {
  const good = await worker.fetch(new Request("https://example.workers.dev/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=abc123"), fakeEnv);
  assert.equal(good.status, 200);
  assert.equal(await good.text(), "abc123");
  const bad = await worker.fetch(new Request("https://example.workers.dev/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123"), fakeEnv);
  assert.equal(bad.status, 403);
});
test("unsigned Instagram and Razorpay webhooks are rejected", async () => {
  for (const path of ["/api/webhook/instagram", "/api/billing/razorpay-webhook"]) {
    const response = await worker.fetch(new Request("https://example.workers.dev" + path, { method: "POST", body: "{}" }), fakeEnv);
    assert.equal(response.status, 403);
  }
});
test("queue handler retries without configured durable executor", async () => {
  const message = { body: { name: "process-comment" }, acked: 0, retried: 0,
    ack() { this.acked++; }, retry() { this.retried++; } };
  await worker.queue({ messages: [message] }, {});
  assert.equal(message.acked, 0);
  assert.equal(message.retried, 1);
});
