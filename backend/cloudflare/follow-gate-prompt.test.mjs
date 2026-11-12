import test from "node:test";
import assert from "node:assert/strict";
import { buildFollowPrompt } from "./follow-gate-prompt.js";
import { sendInstagramDM } from "./instagram-graph.js";
test("Follow Gate prompt binds the button to the exact session", () => {
  const result = buildFollowPrompt({ sessionId: "follow:comment:123:456", profileUrl: "https://www.instagram.com/staging.test/" });
  assert.equal(result.buttons[1].payload, "VERIFY:follow:comment:123:456");
  assert.equal(result.buttons[0].type, "web_url");
});
test("Follow Gate prompt refuses unrelated URLs and malformed session", () => {
  assert.throws(() => buildFollowPrompt({ sessionId: "follow:comment:123:456", profileUrl: "https://example.com/" }), /INVALID_PROFILE_URL/);
  assert.throws(() => buildFollowPrompt({ sessionId: "follow:comment:123:456", profileUrl: "https://instagram.com.evil.example/" }), /INVALID_PROFILE_URL/);
  assert.throws(() => buildFollowPrompt({ sessionId: "follow:comment:x:456", profileUrl: "https://instagram.com/staging/" }), /INVALID_FOLLOW_SESSION/);
});
test("Instagram Graph serializes postback buttons with a bounded payload", async () => {
  const prompt = buildFollowPrompt({ sessionId: "follow:comment:123:456", profileUrl: "https://instagram.com/staging/" });
  let count = 0;
  const fetchImpl = async (_url, options) => {
    count++;
    const body = JSON.parse(options.body);
    assert.equal(body.message.attachment.payload.buttons[1].type, "postback");
    assert.equal(body.message.attachment.payload.buttons[1].payload, "VERIFY:follow:comment:123:456");
    return { ok: true, json: async () => ({ message_id: "test-message" }) };
  };
  const result = await sendInstagramDM({ accessToken: "test-token", instagramBusinessId: "123",
    commentId: "456", message: prompt.text, buttons: prompt.buttons, fetchImpl });
  assert.equal(result.messageId, "test-message");
  assert.equal(count, 1);
});
test("Graph rejects arbitrary postback commands before any request", async () => {
  let called = false;
  await assert.rejects(sendInstagramDM({ accessToken: "test-token", instagramBusinessId: "123",
    commentId: "456", message: "hi", buttons: [{ type: "postback", title: "Click", payload: "UNSAFE" }],
    fetchImpl: async () => { called = true; } }), /INVALID_POSTBACK/);
  assert.equal(called, false);
});
