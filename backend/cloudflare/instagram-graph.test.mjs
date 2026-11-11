import test from "node:test";
import assert from "node:assert/strict";
import { replyToInstagramComment, sendInstagramDM, getInstagramFollowerStatus } from "./instagram-graph.js";

test("reply uses existing Render Graph endpoint and never puts token in URL", async () => {
  let captured;
  const result = await replyToInstagramComment({ accessToken: "secret", commentId: "123", message: "check your dm",
    fetchImpl: async (url, init) => { captured = { url, init }; return { ok: true, json: async () => ({ id: "456" }) }; } });
  assert.equal(result.id, "456");
  assert.equal(captured.url, "https://graph.instagram.com/v25.0/123/replies");
  assert.equal(new URLSearchParams(captured.init.body).get("access_token"), "secret");
  assert.equal(captured.url.includes("secret"), false);
});

test("private DM uses comment_id and bearer token", async () => {
  let captured;
  const result = await sendInstagramDM({ accessToken: "secret", instagramBusinessId: "999",
    commentId: "123", message: "hello", fetchImpl: async (url, init) => {
      captured = { url, init }; return { ok: true, json: async () => ({ message_id: "m1" }) };
    } });
  assert.equal(result.messageId, "m1");
  assert.deepEqual(JSON.parse(captured.init.body).recipient, { comment_id: "123" });
  assert.equal(captured.init.headers.Authorization, "Bearer secret");
});

test("follow-gate resumed DM uses scoped recipient id", async () => {
  let body;
  await sendInstagramDM({ accessToken: "secret", instagramBusinessId: "999", recipientId: "321",
    message: "unlocked", fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body); return { ok: true, json: async () => ({ message_id: "m2" }) };
    } });
  assert.deepEqual(body.recipient, { id: "321" });
});

test("validates buttons and recipient before network requests", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; throw new Error("should not send"); };
  await assert.rejects(sendInstagramDM({ accessToken: "secret", instagramBusinessId: "999", commentId: "bad", message: "hello", fetchImpl }), /INVALID_DM_RECIPIENT/);
  await assert.rejects(sendInstagramDM({ accessToken: "secret", instagramBusinessId: "999", commentId: "123",
    message: "hello", buttons: [{ title: "bad", url: "http://example.com" }], fetchImpl }), /INVALID_BUTTON_URL/);
  assert.equal(called, false);
});

test("does not interpret unknown follower status as not following", async () => {
  await assert.rejects(getInstagramFollowerStatus({ accessToken: "secret", instagramScopedUserId: "321",
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /UNVERIFIED/);
  const result = await getInstagramFollowerStatus({ accessToken: "secret", instagramScopedUserId: "321",
    fetchImpl: async () => ({ ok: true, json: async () => ({ is_user_follow_business: true }) }) });
  assert.equal(result.followsBusiness, true);
});

test("does not treat unsuccessful Graph responses as delivered messages", async () => {
  await assert.rejects(sendInstagramDM({ accessToken: "secret", instagramBusinessId: "999", commentId: "123",
    message: "hello", fetchImpl: async () => ({ ok: false, status: 429 }) }), /INSTAGRAM_GRAPH_REQUEST_FAILED/);
  await assert.rejects(sendInstagramDM({ accessToken: "secret", instagramBusinessId: "999", commentId: "123",
    message: "hello", fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /INSTAGRAM_DM_NOT_CONFIRMED/);
});
