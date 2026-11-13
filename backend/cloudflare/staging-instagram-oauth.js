import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";
import { verifySessionJwt, getTriggerDmUserId } from "./session-jwt.js";
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const encoder = new TextEncoder();
async function signState(userId, secret) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const p = b64(encoder.encode(JSON.stringify({ id: userId, iss: "triggerdm-instagram-oauth", aud: "instagram-v2", iat: now, exp: now + 600 })));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return h + "." + p + "." + b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(h + "." + p))));
}
function config(env) {
  validateStagingMongoConfig(env);
  if (!env?.INSTAGRAM_APP_ID || !env?.INSTAGRAM_APP_SECRET || !env?.INSTAGRAM_REDIRECT_URI_V2 ||
      !env?.STAGING_JWT_SECRET || !env?.FRONTEND_URL) throw new Error("OAUTH_NOT_CONFIGURED");
  const redirect = new URL(env.INSTAGRAM_REDIRECT_URI_V2);
  if (redirect.protocol !== "https:" || !redirect.pathname.endsWith("/instagram/callback-v2")) throw new Error("INVALID_OAUTH_REDIRECT");
}
async function graphJson(url, init = {}) {
  const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("INSTAGRAM_GRAPH_ERROR");
  return response.json();
}
export async function beginStagingInstagramOAuth({ env, userId }) {
  config(env);
  if (!/^[a-f0-9]{24}$/i.test(userId)) throw new Error("INVALID_USER");
  const state = await signState(userId, env.STAGING_JWT_SECRET);
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("force_reauth", "true");
  url.searchParams.set("client_id", env.INSTAGRAM_APP_ID);
  url.searchParams.set("redirect_uri", env.INSTAGRAM_REDIRECT_URI_V2);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages");
  url.searchParams.set("state", state);
  return { success: true, authUrl: url.toString() };
}
export async function completeStagingInstagramOAuth({ env, MongoClient, code, state }) {
  config(env);
  if (typeof code !== "string" || !code || code.length > 2048) throw new Error("INVALID_OAUTH_CODE");
  const claims = await verifySessionJwt(state, env.STAGING_JWT_SECRET, { issuer: "triggerdm-instagram-oauth", audience: "instagram-v2" });
  const userId = new ObjectId(getTriggerDmUserId(claims));
  const token = await graphJson("https://api.instagram.com/oauth/access_token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.INSTAGRAM_APP_ID, client_secret: env.INSTAGRAM_APP_SECRET,
      grant_type: "authorization_code", redirect_uri: env.INSTAGRAM_REDIRECT_URI_V2, code })
  });
  if (!token?.access_token || !/^\d+$/.test(String(token.user_id || ""))) throw new Error("INVALID_INSTAGRAM_TOKEN");
  const exchange = new URL("https://graph.instagram.com/access_token");
  exchange.searchParams.set("grant_type", "ig_exchange_token");
  exchange.searchParams.set("client_secret", env.INSTAGRAM_APP_SECRET);
  exchange.searchParams.set("access_token", token.access_token);
  const long = await graphJson(exchange.toString());
  if (!long?.access_token || !Number.isFinite(Number(long.expires_in))) throw new Error("INVALID_LONG_LIVED_TOKEN");
  const profile = await graphJson("https://graph.instagram.com/me?fields=id%2Cusername&access_token=" + encodeURIComponent(long.access_token));
  if (!/^\d+$/.test(String(profile.id || "")) || String(profile.id) !== String(token.user_id)) throw new Error("INSTAGRAM_IDENTITY_MISMATCH");
  const client = new MongoClient(validateStagingMongoConfig(env).uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(validateStagingMongoConfig(env).dbName);
    const accounts = db.collection("instagramaccounts");
    const [other, own, user, redemption] = await Promise.all([
      accounts.findOne({ instagramBusinessId: String(profile.id), userId: { $ne: userId } }),
      accounts.findOne({ userId }),
      db.collection("users").findOne({ _id: userId }, { projection: { subscriptionStatus: 1 } }),
      db.collection("trialredemptions").findOne({ instagramBusinessId: String(profile.id) })
    ]);
    if (!user) throw new Error("USER_NOT_FOUND");
    if (other) throw new Error("INSTAGRAM_ACCOUNT_ALREADY_CONNECTED");
    if (own && String(own.instagramBusinessId) !== String(profile.id)) throw new Error("ONE_INSTAGRAM_ACCOUNT_LIMIT");
    if (user.subscriptionStatus === "trial" && redemption && String(redemption.userId) !== String(userId)) throw new Error("INSTAGRAM_TRIAL_ALREADY_USED");
    const subscribed = await graphJson("https://graph.instagram.com/v25.0/" + profile.id + "/subscribed_apps", {
      method: "POST", headers: { Authorization: "Bearer " + long.access_token, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ subscribed_fields: "comments,messages,messaging_postbacks" })
    });
    if (subscribed?.success !== true) throw new Error("INSTAGRAM_SUBSCRIPTION_FAILED");
    const now = new Date();
    // Keep ownership and trial identity immutable across reconnects.
    if (user.subscriptionStatus === "trial" && !redemption) {
      try { await db.collection("trialredemptions").insertOne({ instagramBusinessId: String(profile.id), userId, createdAt: now }); }
      catch (error) { if (error.code !== 11000) throw error; const existing = await db.collection("trialredemptions").findOne({ instagramBusinessId: String(profile.id) }); if (String(existing?.userId) !== String(userId)) throw new Error("INSTAGRAM_TRIAL_ALREADY_USED"); }
    }
    const result = await accounts.updateOne({ userId, instagramBusinessId: String(profile.id) }, {
      $set: { pageId: String(profile.id), username: String(profile.username || ""), accessToken: long.access_token,
        pageAccessToken: long.access_token, tokenExpiresAt: new Date(Date.now() + Number(long.expires_in) * 1000),
        status: "active", lastSyncedAt: now, updatedAt: now },
      $setOnInsert: { userId, instagramBusinessId: String(profile.id), connectedAt: now, createdAt: now }
    }, { upsert: true });
    return { success: true, connected: result.acknowledged };
  } finally { await client.close(); }
}
export async function disconnectStagingInstagram({ env, MongoClient, userId, accountId }) {
  if (!/^[a-f0-9]{24}$/i.test(accountId)) return { status: 400, body: { message: "Invalid account ID" } };
  const { uri, dbName } = validateStagingMongoConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const result = await client.db(dbName).collection("instagramaccounts").deleteOne({ _id: new ObjectId(accountId), userId: new ObjectId(userId) });
    return { status: result.deletedCount ? 200 : 404, body: result.deletedCount
      ? { success: true, message: "Instagram account disconnected successfully" }
      : { success: false, message: "Instagram account not found" } };
  } finally { await client.close(); }
}
