// Staging-only JWT verification primitive for the future Cloudflare auth port.
// Does not issue tokens or grant access until wired to validated user lookup.
const enc = new TextEncoder();
function decodeBase64Url(part) {
  if (typeof part !== "string" || !/^[A-Za-z0-9_-]+$/.test(part)) throw new Error("INVALID_TOKEN");
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function parsePart(part) {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64Url(part))); }
  catch { throw new Error("INVALID_TOKEN"); }
}
export async function verifySessionJwt(token, secret, { now = Date.now(), issuer, audience } = {}) {
  if (typeof secret !== "string" || secret.length < 16) throw new Error("JWT_SECRET_NOT_CONFIGURED");
  if (typeof token !== "string" || token.length > 8192) throw new Error("INVALID_TOKEN");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("INVALID_TOKEN");
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = parsePart(headerPart);
  if (!header || header.alg !== "HS256" || header.typ && header.typ !== "JWT" || header.crit) throw new Error("INVALID_TOKEN");
  const payload = parsePart(payloadPart);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("INVALID_TOKEN");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  let valid = false;
  try {
    valid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(signaturePart), enc.encode(headerPart + "." + payloadPart));
  } catch { throw new Error("INVALID_TOKEN"); }
  if (!valid) throw new Error("INVALID_TOKEN");
  const epoch = Math.floor(now / 1000);
  if (!Number.isSafeInteger(payload.exp) || payload.exp <= epoch) throw new Error("TOKEN_EXPIRED");
  if (payload.nbf !== undefined && (!Number.isSafeInteger(payload.nbf) || payload.nbf > epoch)) throw new Error("TOKEN_NOT_ACTIVE");
  if (payload.iat !== undefined && (!Number.isSafeInteger(payload.iat) || payload.iat > epoch + 60)) throw new Error("INVALID_TOKEN");
  if (issuer !== undefined && payload.iss !== issuer) throw new Error("INVALID_TOKEN");
  if (audience !== undefined && !(Array.isArray(payload.aud) ? payload.aud.includes(audience) : payload.aud === audience)) throw new Error("INVALID_TOKEN");
  return payload;
}
