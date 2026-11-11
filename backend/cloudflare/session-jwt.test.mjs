import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { verifySessionJwt, getTriggerDmUserId } from "./session-jwt.js";
const cryptoApi = globalThis.crypto || webcrypto;
const secret = "staging-test-secret-with-at-least-32-characters";
const b64 = data => Buffer.from(JSON.stringify(data)).toString("base64url");
async function sign(payload, keyText = secret, header = { alg: "HS256", typ: "JWT" }) {
  const input = b64(header) + "." + b64(payload);
  const key = await cryptoApi.subtle.importKey("raw", new TextEncoder().encode(keyText), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await cryptoApi.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return input + "." + Buffer.from(signature).toString("base64url");
}
const now = 1_800_000_000_000;
test("accepts valid HS256 JWT with matching issuer and audience", async () => {
  const token = await sign({ sub: "test-user", exp: 1800001000, iss: "staging", aud: "triggerdm" });
  assert.equal((await verifySessionJwt(token, secret, { now, issuer: "staging", audience: "triggerdm" })).sub, "test-user");
});
test("rejects tampering, expired, unsigned and future tokens", async () => {
  const valid = await sign({ sub: "test-user", exp: 1800001000 });
  for (const token of [valid.slice(0, -2) + "zz", await sign({ exp: 1799999999 }), await sign({ exp: 1800001000, nbf: 1800001001 }), await sign({ exp: 1800001000 }, secret, { alg: "none" }), "abc.def.ghi"]) {
    await assert.rejects(verifySessionJwt(token, secret, { now }));
  }
});
test("rejects issuer and audience mismatch", async () => {
  const token = await sign({ exp: 1800001000, iss: "wrong", aud: "wrong" });
  await assert.rejects(verifySessionJwt(token, secret, { now, issuer: "staging" }));
  await assert.rejects(verifySessionJwt(token, secret, { now, audience: "triggerdm" }));
});

test("maps existing Express id claim and rejects conflicting user identities", async () => {
  const id = "507f1f77bcf86cd799439011";
  const token = await sign({ id, exp: 1800001000 });
  const claims = await verifySessionJwt(token, secret, { now });
  assert.equal(getTriggerDmUserId(claims), id);
  assert.equal(getTriggerDmUserId({ sub: id }), id);
  assert.throws(() => getTriggerDmUserId({ id, sub: "507f191e810c19729de860ea" }), /CONFLICTING_USER_CLAIMS/);
  assert.throws(() => getTriggerDmUserId({ id: "not-an-id" }), /INVALID_USER_ID/);
});
