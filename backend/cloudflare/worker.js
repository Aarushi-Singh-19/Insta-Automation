// Isolated Cloudflare migration probe. NEVER connect this URL to Meta or Razorpay yet.
// Webhook POSTs deliberately return 501: acknowledging an event without processing it
// would silently lose comments, DMs, payments, or referral commissions.
import { verifyInstagramChallenge, verifyHmacSha256 } from "./webhook-security.js";
import { consumeActionBatch } from "./action-queue.js";
import { proxyRequest } from "./upstream-proxy.js";
import { runtimeReadiness } from "./runtime-readiness.js";
import { extractInstagramEvents } from "./instagram-events.js";
import { validateStagingMongoConfig, probeStagingMongo } from "./staging-mongodb.js";
import { MongoClient } from "mongodb";

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
    if (request.method === "GET" && url.pathname === "/__cloudflare/staging-db-ping") {
      // Never expose a public Atlas connectivity endpoint without an explicit
      // operator-managed secret. Prevent repeated anonymous database connections.
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      try {
        const result = await probeStagingMongo(env, MongoClient);
        return json(result);
      } catch (error) {
        // Never leak connection strings, database credentials or Atlas hostnames.
        console.error("Staging MongoDB connectivity probe failed", error?.name || "Error");
        return json({ ok: false, connected: false, error: "STAGING_DATABASE_CONNECTION_FAILED" }, 503);
      }
    }
    // Explicit hybrid mode: all API requests, including raw signed webhooks,
    // are passed to the unchanged Express backend. No edge acknowledgments.
    if (env?.UPSTREAM_ORIGIN) return proxyRequest(request, env);
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
