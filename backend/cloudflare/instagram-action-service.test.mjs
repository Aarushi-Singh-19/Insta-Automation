import test from "node:test";
import assert from "node:assert/strict";
import { createInstagramActionService } from "./instagram-action-service.js";
const account = { status: "active", accessToken: "access", pageAccessToken: "page", instagramBusinessId: "ig-1" };
function mock() {
  const calls = [];
  return { calls, service: createInstagramActionService({ fetchImpl: async (url, opts) => {
    calls.push({ url, opts }); return { ok: true, status: 200, json: async () => ({ id: "sent" }) };
  } }) };
}
test("replies using production Graph API version and comment endpoint", async () => {
  const { calls, service } = mock();
  await service.execute({ type: "reply", message: "check your DM" }, { instagramAccount: account, commentId: "c1" });
  assert.match(calls[0].url, /v25\\.0\\/c1\\/replies$/);
  assert.equal(new URLSearchParams(calls[0].opts.body).get("message"), "check your DM");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer access");
});
test("comment-triggered DM uses comment_id and button template", async () => {
  const { calls, service } = mock();
  await service.execute({ type: "send_dm", message: "Open", buttons: [{ title: "Visit", url: "https://example.com" }] },
    { instagramAccount: account, commentId: "c1" });
  const body = JSON.parse(calls[0].opts.body);
  assert.deepEqual(body.recipient, { comment_id: "c1" });
  assert.equal(body.message.attachment.payload.buttons[0].type, "web_url");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer page");
});
test("Follow Gate resumed DM targets recipient id", async () => {
  const { calls, service } = mock();
  await service.execute({ type: "send_dm", message: "Done", recipientId: "recipient" },
    { instagramAccount: account, isGateResume: true, commentId: "c1" });
  assert.deepEqual(JSON.parse(calls[0].opts.body).recipient, { id: "recipient" });
});
test("rejects invalid actions before network calls", async () => {
  const { calls, service } = mock();
  await assert.rejects(service.execute({ type: "send_dm", message: "x" }, { instagramAccount: account }), /commentId/);
  assert.equal(calls.length, 0);
});
test("Graph errors are rejected without exposing tokens", async () => {
  const service = createInstagramActionService({ fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: "sensitive" } }) }) });
  await assert.rejects(service.execute({ type: "reply", message: "x" }, { instagramAccount: account, commentId: "c1" }), /INSTAGRAM_GRAPH_API_FAILED_429/);
});
