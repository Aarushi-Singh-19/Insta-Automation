// Isolated Cloudflare migration probe. NEVER connect this URL to Meta or Razorpay yet.
// Webhook POSTs deliberately return 501: acknowledging an event without processing it
// would silently lose comments, DMs, payments, or referral commissions.
import { verifyInstagramChallenge, verifyHmacSha256 } from "./webhook-security.js";
import { consumeActionBatch } from "./action-queue.js";
import { proxyRequest, cors } from "./upstream-proxy.js";
import { runtimeReadiness } from "./runtime-readiness.js";
import { extractInstagramEvents } from "./instagram-events.js";
import { validateStagingMongoConfig, probeStagingMongo, inspectStagingCollections, inspectStagingDocumentShapes } from "./staging-mongodb.js";
import { MongoClient } from "mongodb";
import { persistInstagramInbox } from "./staging-webhook-inbox.js";
import { verifySessionJwt, getTriggerDmUserId } from "./session-jwt.js";
import { listOwnCampaigns } from "./staging-campaigns.js";
import { getStagingCurrentUser } from "./staging-current-user.js";
import { listStagingRules } from "./staging-rules.js";
import { loginStagingUser } from "./staging-login.js";
import { createStagingRule } from "./staging-rule-create.js";
import { deleteStagingRule } from "./staging-rule-delete.js";
import { toggleStagingRule } from "./staging-rule-toggle.js";
import { updateStagingRule } from "./staging-rule-update.js";
import { planPendingInbox } from "./staging-inbox-planner.js";


export default {
  async queue(batch, env) {
    // Fail closed: no real DB/Instagram executor has been wired to this runtime.
    // Retrying preserves events until a validated executor is deployed.
    return consumeActionBatch(batch);
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedCors = cors(request.headers.get("Origin"));
    const json = (data, status = 200) => Response.json(data, {
      status, headers: { ...allowedCors, "Cache-Control": "no-store" }
    });
    // Browser preflight must succeed at the Worker without relying on Render.
    // This grants no API access; the actual request still requires JWT and flags.
    const nativePath = url.pathname === "/api/auth/login" ||
      url.pathname === "/api/auth/me" ||
      url.pathname === "/api/rules" ||
      /^\/api\/rules\/[a-f0-9]{24}(?:\/toggle)?$/i.test(url.pathname);
    if (request.method === "OPTIONS" && nativePath) {
      return new Response(null, {
        status: Object.keys(allowedCors).length ? 204 : 403,
        headers: { ...allowedCors, "Cache-Control": "no-store" }
      });
    }

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
    if (request.method === "GET" && ["/__cloudflare/staging-db-ping", "/__cloudflare/staging-schema", "/__cloudflare/staging-field-shapes"].includes(url.pathname)) {
      // Never expose a public Atlas connectivity endpoint without an explicit
      // operator-managed secret. Prevent repeated anonymous database connections.
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      try {
        const result = url.pathname === "/__cloudflare/staging-schema"
          ? await inspectStagingCollections(env, MongoClient)
          : url.pathname === "/__cloudflare/staging-field-shapes"
            ? await inspectStagingDocumentShapes(env, MongoClient)
            : await probeStagingMongo(env, MongoClient);
        return json(result);
      } catch (error) {
        // Never leak connection strings, database credentials or Atlas hostnames.
        console.error("Staging MongoDB connectivity probe failed", error?.name || "Error");
        return json({ ok: false, connected: false, error: "STAGING_DATABASE_CONNECTION_FAILED" }, 503);
      }
    }
    // Operator-only readiness check: reports configuration booleans, never secret values.
    // Useful before enabling native auth without exposing internal state publicly.
    if (request.method === "GET" && url.pathname === "/__cloudflare/staging-auth-readiness") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      return json({
        ok: true,
        database: "triggerdm_staging",
        jwtSecretConfigured: typeof env.STAGING_JWT_SECRET === "string" && env.STAGING_JWT_SECRET.length >= 16,
        nativeRoutes: {
          login: env.ENABLE_NATIVE_STAGING_LOGIN === "true",
          authMe: env.ENABLE_NATIVE_STAGING_AUTH_ME === "true",
          rulesRead: env.ENABLE_NATIVE_STAGING_RULES === "true",
          rulesCreate: env.ENABLE_NATIVE_STAGING_RULE_CREATE === "true",
          rulesUpdate: env.ENABLE_NATIVE_STAGING_RULE_UPDATE === "true",
          rulesDelete: env.ENABLE_NATIVE_STAGING_RULE_DELETE === "true",
          rulesToggle: env.ENABLE_NATIVE_STAGING_RULE_TOGGLE === "true"
        }
      });
    }
    // Operator-only staging ingress diagnostics; aggregate counts only, no user data.
    if (request.method === "GET" && url.pathname === "/__cloudflare/staging-inbox-status") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      try {
        const { uri, dbName } = validateStagingMongoConfig(env);
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
        try {
          await client.connect();
          const db = client.db(dbName);
          const inbox = db.collection("cloudflare_staging_webhook_inbox");
          const plans = db.collection("cloudflare_staging_action_plans");
          const [pending, planning, planned, ignored, needsReview, awaitingAuthorization] = await Promise.all([
            inbox.countDocuments({ status: "pending" }),
            inbox.countDocuments({ status: "planning" }),
            inbox.countDocuments({ status: "planned" }),
            inbox.countDocuments({ status: "ignored" }),
            inbox.countDocuments({ status: "needs_review" }),
            plans.countDocuments({ status: "awaiting_authorization" })
          ]);
          return json({ ok: true, database: dbName, inbox: { pending, planning, planned, ignored, needsReview }, plans: { awaitingAuthorization }, instagramMessagesSent: false });
        } finally { await client.close(); }
      } catch (error) {
        console.error("Staging inbox diagnostic failed", error?.name || "Error");
        return json({ ok: false, error: "STAGING_INBOX_STATUS_UNAVAILABLE" }, 503);
      }
    }
    // Native staging login canary; disabled until isolated credentials are configured.
    if (url.pathname === "/api/auth/login" && request.method === "POST" && env?.ENABLE_NATIVE_STAGING_LOGIN === "true") {
      if (!env?.STAGING_JWT_SECRET) return json({ message: "Staging login unavailable" }, 503);
      let body;
      try { body = await request.json(); }
      catch { return json({ message: "Invalid request body" }, 400); }
      try {
        const result = await loginStagingUser({ env, MongoClient, email: body?.email, password: body?.password });
        return json(result.body, result.status);
      } catch (error) {
        console.error("Native staging login failed", error?.name || "Error");
        return json({ message: "Staging login unavailable" }, 503);
      }
    }
    // Native auth/me staging canary. Off by default; never touches production.
    if (url.pathname === "/api/auth/me" && request.method === "GET" && env?.ENABLE_NATIVE_STAGING_AUTH_ME === "true") {
      if (!env?.STAGING_JWT_SECRET) return json({ error: "Native staging auth unavailable" }, 503);
      const authorization = request.headers.get("Authorization") || "";
      if (!authorization.startsWith("Bearer ")) return json({ message: "No token provided" }, 401);
      let userId;
      try {
        userId = getTriggerDmUserId(await verifySessionJwt(authorization.slice(7), env.STAGING_JWT_SECRET));
      } catch { return json({ message: "Invalid token" }, 401); }
      try {
        const user = await getStagingCurrentUser({ env, MongoClient, authenticatedUserId: userId });
        return user ? json({ user }) : json({ message: "User not found" }, 404);
      } catch (error) {
        console.error("Native staging current user failed", error?.name || "Error");
        return json({ message: "Staging user service unavailable" }, 503);
      }
    }
    // Native staging rule edit, opt-in; never modifies production.
    if (request.method === "PATCH" && /^\/api\/rules\/[a-f0-9]{24}$/i.test(url.pathname) && env?.ENABLE_NATIVE_STAGING_RULE_UPDATE === "true") {
      if (!env?.STAGING_JWT_SECRET) return json({ message: "Staging rules unavailable" }, 503);
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ message: "No token provided" }, 401);
      let userId;
      try { userId = getTriggerDmUserId(await verifySessionJwt(auth.slice(7), env.STAGING_JWT_SECRET)); }
      catch { return json({ message: "Invalid token" }, 401); }
      let input;
      try {
        if (Number(request.headers.get("content-length") || 0) > 16384) return json({ message: "Payload too large" }, 413);
        const raw = await request.text();
        if (raw.length > 16384) return json({ message: "Payload too large" }, 413);
        input = JSON.parse(raw);
      } catch { return json({ message: "Invalid request body" }, 400); }
      try {
        const result = await updateStagingRule({ env, MongoClient, authenticatedUserId: userId, ruleId: url.pathname.split("/").at(-1), input });
        return json(result.body, result.status);
      } catch (error) {
        if (["INVALID_RULE", "INVALID_RULE_FIELD"].includes(error?.message)) return json({ message: "Invalid rule fields" }, 400);
        console.error("Native staging rule update failed", error?.name || "Error");
        return json({ message: "Staging rules unavailable" }, 503);
      }
    }
    // Native atomic rule toggle, staging only and disabled by default.
    if (request.method === "PATCH" && /^\/api\/rules\/[a-f0-9]{24}\/toggle$/i.test(url.pathname) && env?.ENABLE_NATIVE_STAGING_RULE_TOGGLE === "true") {
      if (!env?.STAGING_JWT_SECRET) return json({ message: "Staging rules unavailable" }, 503);
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ message: "No token provided" }, 401);
      let userId;
      try { userId = getTriggerDmUserId(await verifySessionJwt(auth.slice(7), env.STAGING_JWT_SECRET)); }
      catch { return json({ message: "Invalid token" }, 401); }
      try {
        const result = await toggleStagingRule({ env, MongoClient, authenticatedUserId: userId, ruleId: url.pathname.split("/")[3] });
        return json(result.body, result.status);
      } catch (error) {
        console.error("Native staging rule toggle failed", error?.name || "Error");
        return json({ message: "Staging rules unavailable" }, 503);
      }
    }
    // Native rule deletion; isolated staging canary, off by default.
    if (request.method === "DELETE" && /^\/api\/rules\/[a-f0-9]{24}$/i.test(url.pathname) && env?.ENABLE_NATIVE_STAGING_RULE_DELETE === "true") {
      if (!env?.STAGING_JWT_SECRET) return json({ message: "Staging rules unavailable" }, 503);
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ message: "No token provided" }, 401);
      let userId;
      try { userId = getTriggerDmUserId(await verifySessionJwt(auth.slice(7), env.STAGING_JWT_SECRET)); }
      catch { return json({ message: "Invalid token" }, 401); }
      try {
        const result = await deleteStagingRule({ env, MongoClient, authenticatedUserId: userId, ruleId: url.pathname.split("/").at(-1) });
        return json(result.body, result.status);
      } catch (error) {
        console.error("Native staging rule delete failed", error?.name || "Error");
        return json({ message: "Staging rules unavailable" }, 503);
      }
    }
    // Native rule creation canary, staging-only and disabled by default.
    if (url.pathname === "/api/rules" && request.method === "POST" && env?.ENABLE_NATIVE_STAGING_RULE_CREATE === "true") {
      if (!env?.STAGING_JWT_SECRET) return json({ message: "Staging rules unavailable" }, 503);
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ message: "No token provided" }, 401);
      let userId;
      try { userId = getTriggerDmUserId(await verifySessionJwt(auth.slice(7), env.STAGING_JWT_SECRET)); }
      catch { return json({ message: "Invalid token" }, 401); }
      let input;
      try {
        if (Number(request.headers.get("content-length") || 0) > 16384) return json({ message: "Payload too large" }, 413);
        const raw = await request.text();
        if (raw.length > 16384) return json({ message: "Payload too large" }, 413);
        input = JSON.parse(raw);
      } catch { return json({ message: "Invalid request body" }, 400); }
      try {
        const result = await createStagingRule({ env, MongoClient, authenticatedUserId: userId, input });
        return json(result.body, result.status);
      } catch (error) {
        if (["INVALID_RULE", "INVALID_RULE_FIELD"].includes(error?.message)) return json({ message: "Invalid rule fields" }, 400);
        console.error("Native staging rule creation failed", error?.name || "Error");
        return json({ message: "Staging rules unavailable" }, 503);
      }
    }
    // Native rules canary; opt-in, read-only, staging database only.
    if (url.pathname === "/api/rules" && request.method === "GET" && env?.ENABLE_NATIVE_STAGING_RULES === "true") {
      if (!env?.STAGING_JWT_SECRET) return json({ success: false, message: "Staging rules unavailable" }, 503);
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ message: "No token provided" }, 401);
      let userId;
      try { userId = getTriggerDmUserId(await verifySessionJwt(auth.slice(7), env.STAGING_JWT_SECRET)); }
      catch { return json({ message: "Invalid token" }, 401); }
      try {
        const data = await listStagingRules({ env, MongoClient, authenticatedUserId: userId });
        return json({ success: true, data });
      } catch (error) {
        console.error("Native staging rules failed", error?.name || "Error");
        return json({ success: false, message: "Staging rules unavailable" }, 503);
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
      let userId;
      try { userId = getTriggerDmUserId(claims); }
      catch { return json({ error: "Unauthorized" }, 401); }
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
    // Operator-only staging planner. No queue, Graph API or DM side effects.
    if (url.pathname === "/__cloudflare/staging-plan" && request.method === "POST") {
      if (env?.ENABLE_STAGING_PLANNER !== "true" || !env?.STAGING_PROBE_TOKEN ||
          request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      try {
        const result = await planPendingInbox({ env, MongoClient, limit: 10 });
        return json({ ok: true, ...result });
      } catch (error) {
        console.error("Staging planning failed", error?.name || "Error");
        return json({ error: "Staging planning unavailable" }, 503);
      }
    }
    // Opt-in isolated ingestion test. Not the live Meta callback URL.
    // Requires both an operator token and a valid Meta HMAC signature.
    if (url.pathname === "/__cloudflare/staging-ingest" && request.method === "POST") {
      if (env?.ENABLE_STAGING_INGEST !== "true" || !env?.STAGING_PROBE_TOKEN || !env?.META_APP_SECRET) {
        return json({ error: "Not found" }, 404);
      }
      if (request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      const raw = await request.text();
      if (raw.length > 256000) return json({ error: "Payload too large" }, 413);
      const signatureHeader = request.headers.get("x-hub-signature-256") || "";
      const signature = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : "";
      if (!await verifyHmacSha256(raw, signature, env.META_APP_SECRET)) {
        return json({ error: "Invalid signature" }, 403);
      }
      let events;
      try { events = extractInstagramEvents(JSON.parse(raw)); }
      catch { return json({ error: "Invalid Instagram event envelope" }, 400); }
      try {
        const result = await persistInstagramInbox({ env, MongoClient, events });
        return json({ ok: true, received: result.received, inserted: result.inserted });
      } catch (error) {
        console.error("Staging inbox write failed", error?.name || "Error");
        return json({ error: "Durable staging storage unavailable" }, 503);
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
