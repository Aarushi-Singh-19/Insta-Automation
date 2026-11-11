import test from "node:test";
import assert from "node:assert/strict";
import { verifyHmacSha256, verifyInstagramChallenge } from "./webhook-security.js";

async function signature(body, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
test("accepts correctly signed raw webhook body and rejects tampering", async () => {
  const secret = "staging-secret"; const body = '{"entry":[{"id":"1"}]}';
  const sig = await signature(body, secret);
  assert.equal(await verifyHmacSha256(body, sig, secret), true);
  assert.equal(await verifyHmacSha256(body + " ", sig, secret), false);
  assert.equal(await verifyHmacSha256(body, sig, "wrong"), false);
  assert.equal(await verifyHmacSha256(body, "", secret), false);
});
test("Meta verification requires subscribe mode and exact token", () => {
  const url = "https://example.com/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=staging&hub.challenge=123";
  assert.equal(verifyInstagramChallenge(url, "staging"), "123");
  assert.equal(verifyInstagramChallenge(url, "production"), null);
  assert.equal(verifyInstagramChallenge(url.replace("subscribe", "unsubscribe"), "staging"), null);
});
