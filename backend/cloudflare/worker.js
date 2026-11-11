// Isolated Cloudflare migration probe. NEVER connect this URL to Meta or Razorpay yet.
// Webhook POSTs deliberately return 501: acknowledging an event without processing it
// would silently lose comments, DMs, payments, or referral commissions.
import { verifyInstagramChallenge, verifyHmacSha256 } from "./webhook-security.js";
import { consumeActionBatch } from "./action-queue.js";
import { proxyRequest } from "./upstream-proxy.js";
import { runtimeReadiness } from "./runtime-readiness.js";
import { extractInstagramEvents } from "./instagram-events.js";
import { validateStagingMongoConfig, probeStagingMongo, inspectStagingCollections } from "./staging-mongodb.js";
import { MongoClient } from "mongodb";
import { verifySessionJwt } from "./session-jwt.js";
import { listOwnCampaigns } from "./staging-campaigns.js";

const json = (data, status = 200) => Response.json(data, { status });

export default {
  async queue(batch, env) {
    // Fail closed: no real DB/Instagram executor has been wired to this runtime.
    // Retrying preserves events until a validated executor is deployed.
    return consumeActionBatch(batch);
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/__cloudflare/health") {
      return json(runtimeReadiness(env));
    }
    if (request.method === "GET" && url.pathname === "/__cloudflare/staging-db-config") {
      try {
        const { dbName } = validateStagingMongoConfig(env);
        return json({ ok: true, database: dbName, credentials: "configured", connected: false });
      } catch (error) {
        return json({ ok: false, error: error.message, connected: false }, 503);
      }
    }
    if (request.method === "GET" && ["/__cloudflare/staging-db-ping", "/__cloudflare/staging-schema"].includes(url.pathname)) {
      // Never expose a public Atlas connectivity endpoint without an explicit
      // operator-managed secret. Prevent repeated anonymous database connections.
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      try {
        const result = url.pathname === "/__cloudflare/staging-schema"
          ? await inspectStagingCollections(env, MongoClient)
          : await probeStagingMongo(env, MongoClient);
        return json(result);
      } catch (error) {
        // Never leak connection strings, database credentials or Atlas hostnames.
        console.error("Staging MongoDB connectivity probe failed", error?.name || "Error");
        return json({ ok: false, connected: false, error: "STAGING_DATABASE_CONNECTION_FAILED" }, 503);
      }
    }
    // Isolated staging route: verified JWT only; never accepts a caller-supplied
    // user ID. Requires an independent staging JWT secret and explicit opt-in.
    if (url.pathname === "/__cloudflare/api/campaigns" && request.method === "GET") {
      if (env?.ENABLE_STAGING_CAMPAIGN_API !== "true" || !env?.STAGING_JWT_SECRET) {
        return json({ error: "Not found" }, 404);
      }
      const authorization = request.headers.get("Authorization") || "";
      if (!authorization.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      let claims;
      try {
        claims = await verifySessionJwt(authorization.slice(7), env.STAGING_JWT_SECRET);
      } catch { return json({ error: "Unauthorized" }, 401); }
      const userId = claims?.sub;
      if (typeof userId !== "string" || !/^[a-f0-9]{24}$/i.test(userId)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const limitValue = url.searchParams.get("limit");
      const limit = limitValue === null ? 20 : Number(limitValue);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        return json({ error: "Invalid limit" }, 400);
      }
      try {
        const campaigns = await listOwnCampaigns({ env, MongoClient, authenticatedUserId: userId, limit });
        return json({ campaigns });
      } catch (error) {
        console.error("Staging campaign query failed", error?.name || "Error");
        return json({ error: "Staging campaign service unavailable" }, 503);
      }
    }
    // Never proxy webhook traffic during migration. A suspended upstream can
    // respond unpredictably, and accepting payments/comments without durable
    // processing would cause silent loss. Handle signature checks locally.
    const isWebhook = url.pathname === "/api/webhook/instagram" ||
      url.pathname === "/api/billing/razorpay-webhook";
    if (env?.UPSTREAM_ORIGIN && !isWebhook) return proxyRequest(request, env);
    if (url.pathname === "/api/webhook/instagram") {
      if (request.method === "GET") {
        const challenge = verifyInstagramChallenge(request.url, env?.VERIFY_TOKEN);
        return challenge === null
          ? new Response("Forbidden", { status: 403 })
          : new Response(challenge, { status: 200 });
      }
      if (request.method === "POST") {
        const rawBody = await request.text();
        const header = request.headers.get("x-hub-signature-256") || "";
        const signature = header.startsWith("sha256=") ? header.slice(7) : "";
        const valid = await verifyHmacSha256(rawBody, signature, env?.META_APP_SECRET);
        if (!valid) return json({ error: "Invalid signature" }, 403);
        try { extractInstagramEvents(JSON.parse(rawBody)); }
        catch { return json({ error: "Invalid Instagram event envelope" }, 400); }
        // A valid event must NOT be acknowledged before durable processing exists.
        return json({ error: "Webhook processing not migrated; do not configure Meta callback here" }, 501);
      }
    }
    if (url.pathname === "/api/billing/razorpay-webhook" && request.method === "POST") {
      const rawBody = await request.text();
      const valid = await verifyHmacSha256(
        rawBody,
        request.headers.get("x-razorpay-signature"),
        env?.RAZORPAY_WEBHOOK_SECRET
      );
      if (!valid) return json({ error: "Invalid signature" }, 403);
      return json({ error: "Payment processing not migrated; do not configure Razorpay here" }, 501);
    }
    return json({ error: "Not implemented: migration in progress" }, 501);
  },
};
