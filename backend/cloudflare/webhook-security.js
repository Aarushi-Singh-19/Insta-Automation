// Pure webhook verification helpers for the isolated Cloudflare migration.
// These helpers do not dispatch events, send DMs, or modify databases.
const encoder = new TextEncoder();

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyHmacSha256(body, signature, secret, format = "hex") {
  if (typeof body !== "string" || !signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  const expected = format === "hex" ? toHex(signed) : btoa(String.fromCharCode(...signed));
  return constantTimeEqual(expected, signature);
}

export function verifyInstagramChallenge(url, expectedToken) {
  const params = new URL(url).searchParams;
  if (!expectedToken || params.get("hub.mode") !== "subscribe") return null;
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  return token === expectedToken && challenge !== null ? challenge : null;
}
