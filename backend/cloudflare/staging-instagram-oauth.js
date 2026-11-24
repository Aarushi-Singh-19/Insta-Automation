import { validateProductionMongoConfig } from "./production-mongodb.js";
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
function oauthDatabase(env) {
  if (env?.TRIGGERDM_RUNTIME !== "production") return validateStagingMongoConfig(env);
  if (env.ENABLE_PRODUCTION_INSTAGRAM_OAUTH !== "true") throw new Error("PRODUCTION_OAUTH_DISABLED");
  return validateProductionMongoConfig(env);
}
function config(env) {
  const database = oauthDatabase(env);
  const production = env?.TRIGGERDM_RUNTIME === "production";
  const secret = production ? env.PRODUCTION_JWT_SECRET : env.STAGING_JWT_SECRET;
  if (!env?.INSTAGRAM_APP_ID || !env?.INSTAGRAM_APP_SECRET || !env?.INSTAGRAM_REDIRECT_URI_V2 ||
      !secret || !env?.FRONTEND_URL) throw new Error("OAUTH_NOT_CONFIGURED");
  const redirect = new URL(env.INSTAGRAM_REDIRECT_URI_V2);
  if (redirect.protocol !== "https:" || !redirect.pathname.endsWith("/instagram/callback-v2")) throw new Error("INVALID_OAUTH_REDIRECT");
  if (production && (typeof secret !== "string" || secret.length < 32 ||
      secret === env.STAGING_JWT_SECRET || redirect.username || redirect.password ||
      redirect.search || redirect.hash)) throw new Error("INVALID_PRODUCTION_OAUTH_CONFIG");
  return { ...database, secret, production };
}
async function graphJson(url, init = {}) {
  let response;
  try {
    response = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(12000) });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new Error(timeout ? "INSTAGRAM_REQUEST_TIMEOUT" : "INSTAGRAM_REQUEST_FAILED");
  }
  if (response.status >= 300 && response.status < 400) throw new Error("INSTAGRAM_UNEXPECTED_REDIRECT");
  if (!response.ok) {
    const error = new Error("INSTAGRAM_GRAPH_ERROR");
    error.upstreamStatus = response.status;
    throw error;
  }
  try {
    return await response.json();
  } catch {
    throw new Error("INSTAGRAM_INVALID_JSON");
  }
}
export async function beginStagingInstagramOAuth({ env, userId }) {
  const { secret } = config(env);
  if (!/^[a-f0-9]{24}$/i.test(userId)) throw new Error("INVALID_USER");
  const state = await signState(userId, secret);
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("force_reauth", "true");
  url.searchParams.set("client_id", env.INSTAGRAM_APP_ID);
  url.searchParams.set("redirect_uri", env.INSTAGRAM_REDIRECT_URI_V2);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages");
  url.searchParams.set("state", state);
  return { success: true, authUrl: url.toString() };
}
export async function completeStagingInstagramOAuth({ env, MongoClient, code, state, onStage = () => {} }) {
  onStage("configuration");
  const { uri, dbName, secret, production } = config(env);
  if (typeof code !== "string" || !code || code.length > 2048) throw new Error("INVALID_OAUTH_CODE");
  onStage("oauth-state");
  const claims = await verifySessionJwt(state, secret, { issuer: "triggerdm-instagram-oauth", audience: "instagram-v2" });
  const userId = new ObjectId(getTriggerDmUserId(claims));
  onStage("code-exchange");
  const form = new FormData();
  form.set("client_id", env.INSTAGRAM_APP_ID);
  form.set("client_secret", env.INSTAGRAM_APP_SECRET);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", env.INSTAGRAM_REDIRECT_URI_V2);
  form.set("code", code);
  const token = await graphJson("https://api.instagram.com/oauth/access_token", {
    method: "POST", body: form,
  });
  if (!token?.access_token || !/^\d+$/.test(String(token.user_id || ""))) throw new Error("INVALID_INSTAGRAM_TOKEN");
  const exchange = new URL("https://graph.instagram.com/access_token");
  exchange.searchParams.set("grant_type", "ig_exchange_token");
  exchange.searchParams.set("client_secret", env.INSTAGRAM_APP_SECRET);
  exchange.searchParams.set("access_token", token.access_token);
  onStage("long-lived-token");
  const long = await graphJson(exchange.toString());
  if (!long?.access_token || !Number.isFinite(Number(long.expires_in))) throw new Error("INVALID_LONG_LIVED_TOKEN");
  onStage("profile");
  const profile = await graphJson("https://graph.instagram.com/me?fields=user_id%2Cusername&access_token=" + encodeURIComponent(long.access_token));
  const instagramUserId = String(profile?.user_id ?? "");
  // Meta can encode the exchange ID as a JSON number. Keep the profile's
  // exact string for storage and compare at the exchange's available precision.
  const sameUser = typeof token.user_id === "number"
    ? Number(instagramUserId) === token.user_id
    : instagramUserId === token.user_id;
  if (!/^\d+$/.test(instagramUserId) || !sameUser ||
      (typeof profile.user_id === "number" && !Number.isSafeInteger(profile.user_id))) {
    throw new Error("INSTAGRAM_IDENTITY_MISMATCH");
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    onStage("database-connect");
    await client.connect();
    const db = client.db(dbName);
    const accounts = db.collection("instagramaccounts");
    if (production) {
      // Enforce both ownership invariants under concurrent OAuth callbacks.
      onStage("database-indexes");
      await Promise.all([
        accounts.createIndex({ userId: 1 }, { unique: true, name: "cloudflare_one_instagram_account_per_user" }),
        accounts.createIndex({ instagramBusinessId: 1 }, { unique: true, name: "cloudflare_unique_instagram_owner" }),
      ]);
    }
    onStage("ownership-check");
    const [other, own, user, redemption] = await Promise.all([
      accounts.findOne({ instagramBusinessId: instagramUserId, userId: { $ne: userId } }),
      accounts.findOne({ userId }),
      db.collection("users").findOne({ _id: userId }, { projection: { subscriptionStatus: 1 } }),
      db.collection("trialredemptions").findOne({ instagramBusinessId: instagramUserId })
    ]);
    if (!user) throw new Error("USER_NOT_FOUND");
    if (other) throw new Error("INSTAGRAM_ACCOUNT_ALREADY_CONNECTED");
    if (own && String(own.instagramBusinessId) !== instagramUserId) throw new Error("ONE_INSTAGRAM_ACCOUNT_LIMIT");
    if (user.subscriptionStatus === "trial" && redemption && String(redemption.userId) !== String(userId)) throw new Error("INSTAGRAM_TRIAL_ALREADY_USED");
    onStage("webhook-subscription");
    const subscribed = await graphJson("https://graph.instagram.com/v25.0/" + instagramUserId + "/subscribed_apps", {
      method: "POST", headers: { Authorization: "Bearer " + long.access_token, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ subscribed_fields: "comments,messages,messaging_postbacks" })
    });
    if (subscribed?.success !== true) throw new Error("INSTAGRAM_SUBSCRIPTION_FAILED");
    onStage("save-account");
    const now = new Date();
    // Keep ownership and trial identity immutable across reconnects.
    if (user.subscriptionStatus === "trial" && !redemption) {
      try { await db.collection("trialredemptions").insertOne({ instagramBusinessId: instagramUserId, userId, createdAt: now }); }
      catch (error) { if (error.code !== 11000) throw error; const existing = await db.collection("trialredemptions").findOne({ instagramBusinessId: instagramUserId }); if (String(existing?.userId) !== String(userId)) throw new Error("INSTAGRAM_TRIAL_ALREADY_USED"); }
    }
    const result = await accounts.updateOne({ userId, instagramBusinessId: instagramUserId }, {
      $set: { pageId: instagramUserId, username: String(profile.username || ""), accessToken: long.access_token,
        pageAccessToken: long.access_token, tokenExpiresAt: new Date(Date.now() + Number(long.expires_in) * 1000),
        status: "active", lastSyncedAt: now, updatedAt: now },
      $setOnInsert: { userId, instagramBusinessId: instagramUserId, connectedAt: now, createdAt: now }
    }, { upsert: true });
    return { success: true, connected: result.acknowledged };
  } finally { await client.close(); }
}
export async function disconnectStagingInstagram({ env, MongoClient, userId, accountId }) {
  if (!/^[a-f0-9]{24}$/i.test(accountId)) return { status: 400, body: { message: "Invalid account ID" } };
  const { uri, dbName } = oauthDatabase(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const result = await client.db(dbName).collection("instagramaccounts").deleteOne({ _id: new ObjectId(accountId), userId: new ObjectId(userId) });
    return { status: result.deletedCount ? 200 : 404, body: result.deletedCount
      ? { success: true, message: "Instagram account disconnected successfully" }
      : { success: false, message: "Instagram account not found" } };
  } finally { await client.close(); }
}
