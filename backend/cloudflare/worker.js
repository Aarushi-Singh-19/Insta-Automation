import { referralSummary, payoutRequests } from "./staging-referrals.js";
// Isolated Cloudflare migration probe. NEVER connect this URL to Meta or Razorpay yet.
// Webhook POSTs deliberately return 501: acknowledging an event without processing it
// would silently lose comments, DMs, payments, or referral commissions.
import { verifyInstagramChallenge, verifyHmacSha256 } from "./webhook-security.js";
import { createStagingSubscription, stagingPaymentHistory, reconcileStagingSubscription, processStagingRazorpayWebhook, recoverStagingBilling } from "./staging-razorpay.js";
import { consumeActionBatch } from "./action-queue.js";
import { proxyRequest, cors } from "./upstream-proxy.js";
import { runtimeReadiness } from "./runtime-readiness.js";
import { extractInstagramEvents } from "./instagram-events.js";
import { mapApprovedStagingWebhookEvents } from "./staging-webhook-account-map.js";
import { validateStagingMongoConfig, probeStagingMongo, inspectStagingCollections, inspectStagingDocumentShapes } from "./staging-mongodb.js";
import { MongoClient, ObjectId } from "mongodb";
import { persistInstagramInbox } from "./staging-webhook-inbox.js";
import { verifySessionJwt, getTriggerDmUserId } from "./session-jwt.js";
import { listOwnCampaigns } from "./staging-campaigns.js";
import { getStagingCurrentUser } from "./staging-current-user.js";
import { listStagingRules } from "./staging-rules.js";
import { loginStagingUser } from "./staging-login.js";
import { listStagingInstagramAccounts } from "./staging-instagram-accounts.js";
import { listStagingInstagramMedia } from "./staging-instagram-media.js";
import { stagingAutomations } from "./staging-automations.js";
import { createStagingRule } from "./staging-rule-create.js";
import { deleteStagingRule } from "./staging-rule-delete.js";
import { toggleStagingRule } from "./staging-rule-toggle.js";
import { updateStagingRule } from "./staging-rule-update.js";
import { planPendingInbox } from "./staging-inbox-planner.js";
import { resolveStagingComment } from "./staging-comment-resolver.js";
import { prepareStagingActionOutbox } from "./staging-action-outbox.js";
import { executeStagingActions } from "./staging-action-executor.js";
import { planCommentAutomation } from "./comment-planner.js";
import { buildCommentActionSpec } from "./comment-action-spec.js";
import { followGateDecision } from "./follow-gate-state.js";
import { drainStagingInbox } from "./staging-background.js";
import { inspectStagingAutomationReadiness } from "./staging-automation-readiness.js";
import { authorizeCommentActions } from "./automation-authorization.js";
import { verifiedQuotaState } from "./quota-reconciliation.js";
import { getInstagramFollowerStatus } from "./instagram-graph.js";
import { confirmFollowGate } from "./follow-gate-state.js";


export default {
  async scheduled(event, env, ctx) {
    // Cron drains only durable staging records. No Instagram sends.
    ctx.waitUntil(drainStagingInbox({ env, MongoClient }));
    if (env?.ENABLE_STAGING_RAZORPAY === "true") {
      ctx.waitUntil(recoverStagingBilling({ env, MongoClient }).catch(error => {
        console.error("Staging billing recovery cron failed", {
          category: error?.name || "Error", code: error?.code ?? null
        });
      }));
    }
  },
  async queue(batch, env) {
    // Fail closed: no real DB/Instagram executor has been wired to this runtime.
    // Retrying preserves events until a validated executor is deployed.
    return consumeActionBatch(batch);
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const allowedCors = cors(request.headers.get("Origin"));
    const json = (data, status = 200) => Response.json(data, {
      status, headers: { ...allowedCors, "Cache-Control": "no-store" }
    });
    // Browser preflight must succeed at the Worker without relying on Render.
    // This grants no API access; the actual request still requires JWT and flags.
    const nativePath = /^\/(?:api\/)?referrals(?:\/summary|\/payouts\/requests|\/payouts\/admin\/requests(?:\/[a-f0-9]{24})?)$/.test(url.pathname) || ["/billing/create-subscription", "/api/billing/create-subscription", "/billing/history", "/api/billing/history",
         "/billing/reconcile", "/api/billing/reconcile"].includes(url.pathname) || /^\/(?:api\/)?automations\/[a-f0-9]{24}$/i.test(url.pathname) || ["/automations", "/api/automations", "/instagram/accounts", "/api/instagram/accounts", "/instagram/media", "/api/instagram/media"].includes(url.pathname) || url.pathname === "/auth/login" || url.pathname === "/auth/me" ||
      url.pathname === "/api/auth/login" ||
      url.pathname === "/api/auth/me" ||
      url.pathname === "/api/rules" ||
      /^\/api\/rules\/[a-f0-9]{24}(?:\/toggle)?$/i.test(url.pathname);
    if (request.method === "OPTIONS" && nativePath) {
      return new Response(null, {
        status: Object.keys(allowedCors).length ? 204 : 403,
        headers: { ...allowedCors, "Cache-Control": "no-store" }
      });
    }

    // Public read-only synthetic smoke test: no secrets, DB writes, Meta calls,
    // user data, or simulated claims of successful real-world delivery.
    if (request.method === "GET" && url.pathname === "/__cloudflare/instagram-self-test") {
      const comment = { entryId: "123456", eventId: "789012", postId: "345678", commentText: "send guide" };
      const campaign = { _id: "a".repeat(24), status: "active", triggerType: "specific-post",
        instagramMediaId: comment.postId, settings: { enableReply: true, enableDM: true, dmMessage: "Here is the guide" },
        gate: { gateType: "FOLLOW", status: "enabled" } };
      const rule = { _id: "b".repeat(24), isActive: true, triggerType: "keyword",
        triggerKeywords: ["guide"], replies: ["Check your DM"] };
      const matched = planCommentAutomation({ comment, campaign, rule });
      const action = buildCommentActionSpec({ comment, campaign, rule });
      const rejected = planCommentAutomation({ comment: { ...comment, commentText: "unrelated" }, campaign, rule });
      const gate = campaign.gate;
      const checks = {
        matchingComment: matched.matched === true,
        unrelatedCommentRejected: rejected.matched === false,
        replyPrepared: action.ready === true && action.spec?.reply?.message === "Check your DM",
        dmPrepared: action.ready === true && action.spec?.dm?.message === "Here is the guide",
        followGateBlocksUnverified: followGateDecision({ gate, followerStatus: false }).action === "request_follow",
        followGateBypassesVerified: followGateDecision({ gate, followerStatus: true }).action === "deliver",
        unknownFollowStatusHeld: followGateDecision({ gate }).action === "hold"
      };
      return json({ ok: Object.values(checks).every(Boolean), mode: "synthetic-read-only", checks,
        realWebhookTested: false, realInstagramMessagesSent: false }, Object.values(checks).every(Boolean) ? 200 : 503);
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
    if (request.method === "GET" && url.pathname === "/__cloudflare/staging-automation-readiness") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      try {
        return json(await inspectStagingAutomationReadiness({ env, MongoClient }));
      } catch (error) {
        console.error("Staging automation preflight failed", error?.name || "Error");
        return json({ ok: false, error: "STAGING_AUTOMATION_PREFLIGHT_UNAVAILABLE" }, 503);
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
    // Operator-authorized one-comment import from the actual Instagram Graph API.
    // Does not send; preserves production webhook and fails closed on duplicates.
    if (request.method === "POST" && url.pathname === "/__cloudflare/staging-import-real-comment") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      // Import only verifies and stores the selected comment; it never sends.
      // The independently gated executor controls real delivery.
      let client;
      try {
        const body = await request.json();
        const commentId = String(body?.commentId || "");
        if (!/^\d{8,30}$/.test(commentId)) return json({ error: "INVALID_COMMENT_ID" }, 400);
        const { uri, dbName } = validateStagingMongoConfig(env);
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
        await client.connect();
        const db = client.db(dbName);
        const accounts = await db.collection("instagramaccounts").find({ status: "active" })
          .project({ instagramBusinessId: 1, userId: 1, accessToken: 1 }).limit(2).toArray();
        if (accounts.length !== 1 || !accounts[0].accessToken) {
          return json({ ok: false, error: "REQUIRES_ONE_ACTIVE_ACCOUNT" }, 409);
        }
        const account = accounts[0];
        const graph = await fetch("https://graph.instagram.com/v25.0/" + commentId +
          "?fields=id,text,timestamp,from{id,username},media{id}", {
          headers: { Authorization: "Bearer " + account.accessToken }
        });
        if (!graph.ok) return json({ ok: false, error: "GRAPH_COMMENT_FETCH_FAILED", graphStatus: graph.status }, 502);
        const comment = await graph.json();
        if (String(comment?.id) !== commentId || !/^\d+$/.test(String(comment?.media?.id || "")) ||
            String(comment?.from?.id || "") === String(account.instagramBusinessId)) {
          return json({ ok: false, error: "INVALID_OR_OWN_COMMENT" }, 409);
        }
        const event = { entryId: String(account.instagramBusinessId), eventId: commentId,
          postId: String(comment.media.id), commentText: String(comment.text || ""),
          username: String(comment.from?.username || "unknown"),
          recipientId: comment.from?.id ? String(comment.from.id) : null,
          commentTimestamp: comment.timestamp || null };
        const match = await resolveStagingComment({ db, comment: event });
        if (!match) return json({ ok: false, error: "NO_UNAMBIGUOUS_STAGING_RULE_MATCH" }, 409);
        const stored = await persistInstagramInbox({ env, MongoClient,
          events: { comments: [event], postbacks: [] } });
        return json({ ok: true, source: "verified-instagram-graph", commentId,
          matched: true, inserted: stored.inserted === 1, duplicate: stored.inserted === 0,
          inboxStatus: "pending", instagramMessagesSent: false });
      } catch (error) {
        console.error("Staging real comment import failed", error?.name || "Error");
        return json({ ok: false, error: "REAL_COMMENT_IMPORT_FAILED" }, 503);
      } finally { if (client) await client.close(); }
    }
    // Retrieve real recent comments from Instagram directly without changing
    // production webhook routing. Read-only, staging account and post only.
    if (request.method === "GET" && url.pathname === "/__cloudflare/staging-real-comments") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      let client;
      try {
        const { uri, dbName } = validateStagingMongoConfig(env);
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
        await client.connect();
        const db = client.db(dbName);
        const accounts = await db.collection("instagramaccounts").find({ status: "active" })
          .project({ instagramBusinessId: 1, userId: 1, accessToken: 1 }).limit(2).toArray();
        if (accounts.length !== 1 || !accounts[0].accessToken) {
          return json({ ok: false, reason: "REQUIRES_ONE_ACTIVE_STAGING_ACCOUNT" }, 409);
        }
        const account = accounts[0];
        const campaigns = await db.collection("campaigns").find({
          status: "active", userId: account.userId, triggerType: "specific-post"
        }).project({ instagramMediaId: 1, postIds: 1 }).limit(3).toArray();
        const postIds = [...new Set(campaigns.flatMap(c =>
          [c.instagramMediaId, ...(Array.isArray(c.postIds) ? c.postIds : [])]
            .map(String).filter(v => /^\d{8,30}$/.test(v))))];
        if (postIds.length !== 1) return json({ ok: false, reason: "REQUIRES_ONE_STAGING_POST" }, 409);
        const response = await fetch("https://graph.instagram.com/v25.0/" + postIds[0] +
          "/comments?fields=id,text,timestamp,from{id,username}&limit=25", {
          headers: { Authorization: "Bearer " + account.accessToken }
        });
        if (!response.ok) return json({ ok: false, reason: "INSTAGRAM_COMMENTS_FETCH_FAILED",
          graphStatus: response.status }, 502);
        const payload = await response.json();
        if (!Array.isArray(payload?.data)) return json({ ok: false, reason: "INVALID_GRAPH_RESPONSE" }, 502);
        const comments = payload.data.filter(c => /^\d+$/.test(String(c.id || "")) &&
          String(c.from?.id || "") !== String(account.instagramBusinessId))
          .slice(0, 10).map(c => ({
            commentId: String(c.id), keywordTest: /test/i.test(String(c.text || "")),
            timestamp: c.timestamp || null
          }));
        return json({ ok: true, source: "real-instagram-graph-read-only", postId: postIds[0],
          comments, inboxWritten: false, instagramMessagesSent: false });
      } catch (error) {
        console.error("Real staging comment lookup failed", error?.name || "Error");
        return json({ ok: false, reason: "REAL_COMMENT_LOOKUP_FAILED" }, 503);
      } finally { if (client) await client.close(); }
    }
    // Consolidated operator-only cutover gate. Reports blockers instead of
    // implying synthetic checks prove real payment or Instagram delivery.
    if (request.method === "GET" && url.pathname === "/__cloudflare/staging-cutover-audit") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      let client;
      try {
        const { uri, dbName } = validateStagingMongoConfig(env);
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
        await client.connect();
        const db = client.db(dbName);
        const [accounts, campaigns, verifiedQuotas, pendingOutbox, needsReview, inboxPending] = await Promise.all([
          db.collection("instagramaccounts").countDocuments({ status: "active" }),
          db.collection("campaigns").countDocuments({ status: "active" }),
          db.collection("cloudflare_staging_dm_quotas").countDocuments({
            baselineVerified: true, baselineSource: "render-reconciliation"
          }),
          db.collection("cloudflare_staging_action_outbox").countDocuments({
            status: { $in: ["awaiting_authorization", "awaiting_follow"] }
          }),
          db.collection("cloudflare_staging_action_outbox").countDocuments({ status: "needs_review" }),
          db.collection("cloudflare_staging_webhook_inbox").countDocuments({ status: "pending" })
        ]);
        const blockers = [
          ...(verifiedQuotas === 0 ? ["NO_VERIFIED_RENDER_QUOTA_BASELINE"] : []),
          "REAL_META_WEBHOOK_DELIVERY_UNVERIFIED",
          "REAL_INSTAGRAM_REPLY_AND_DM_UNVERIFIED",
          "RAZORPAY_WEBHOOK_PROCESSING_NOT_MIGRATED",
          "REFERRAL_COMMISSION_AND_PAYOUT_FLOW_NOT_MIGRATED",
          "PRODUCTION_CUTOVER_NOT_VALIDATED"
        ];
        return json({ ok: true, productionCutoverReady: false, database: dbName,
          staging: { activeAccounts: accounts, activeCampaigns: campaigns,
            verifiedQuotaCounters: verifiedQuotas, pendingOutbox, needsReview, inboxPending },
          protections: { instagramSendEnabled: env?.ENABLE_STAGING_INSTAGRAM_SEND === "true",
            backgroundSendEnabled: env?.ENABLE_STAGING_BACKGROUND_SEND === "true" },
          blockers, realInstagramMessagesSentByAudit: 0 });
      } catch (error) {
        console.error("Staging cutover audit failed", error?.name || "Error");
        return json({ ok: false, productionCutoverReady: false, error: "STAGING_AUDIT_UNAVAILABLE" }, 503);
      } finally { if (client) await client.close(); }
    }
    // Isolated concurrent quota reservation smoke test. Test-only collection,
    // no live quota mutations, no sends; verifies unique action id and capacity.
    if (request.method === "POST" && url.pathname === "/__cloudflare/staging-quota-concurrency-test") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      if (env?.ENABLE_STAGING_INSTAGRAM_SEND === "true" || env?.ENABLE_STAGING_BACKGROUND_SEND === "true") {
        return json({ ok: false, error: "SEND_MUST_BE_DISABLED" }, 409);
      }
      let client;
      try {
        const { uri, dbName } = validateStagingMongoConfig(env);
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection("cloudflare_staging_quota_smoke_tests");
        const key = "isolated:quota:concurrency:v1";
        // Unique test key is isolated from the actual quota and send collections.
        // Reset only this known synthetic document, never user data.
        await collection.updateOne({ _id: key }, { $set: { reserved: 0, limit: 1, actions: [] } }, { upsert: true });
        const attempts = await Promise.all(Array.from({ length: 12 }, (_, i) =>
          collection.updateOne({ _id: key, reserved: { $lt: 1 }, actions: { $ne: "test-action-" + i } },
            { $inc: { reserved: 1 }, $addToSet: { actions: "test-action-" + i } })
        ));
        const duplicate = await collection.updateOne({ _id: key, reserved: { $lt: 1 }, actions: { $ne: "test-action-0" } },
          { $inc: { reserved: 1 }, $addToSet: { actions: "test-action-0" } });
        const state = await collection.findOne({ _id: key });
        const checks = { oneReservationOnly: attempts.reduce((n, x) => n + x.modifiedCount, 0) === 1,
          capacityNeverExceeded: state?.reserved === 1, duplicateNotReserved: duplicate.modifiedCount === 0,
          uniqueActionRecorded: state?.actions?.length === 1 };
        await collection.deleteOne({ _id: key });
        return json({ ok: Object.values(checks).every(Boolean), database: dbName,
          checks, mode: "isolated-mongodb-concurrency", realQuotaReservationTested: false,
          realInstagramMessagesSent: false }, Object.values(checks).every(Boolean) ? 200 : 503);
      } catch (error) {
        console.error("Staging quota concurrency smoke test failed", error?.name || "Error");
        return json({ ok: false, error: "STAGING_QUOTA_CONCURRENCY_FAILED" }, 503);
      } finally { if (client) await client.close(); }
    }
    // Pure authorization boundary matrix: no DB writes, quota changes or Meta calls.
    if (request.method === "GET" && url.pathname === "/__cloudflare/staging-authorization-smoke-test") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      const now = new Date("2026-11-12T12:00:00Z");
      const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
      const user = { _id: id, subscriptionStatus: "trial",
        trialEndDate: new Date("2026-11-20T00:00:00Z"), planEndDate: new Date("2026-12-20T00:00:00Z") };
      const campaign = { userId: id, status: "active", gate: { gateType: "NONE", status: "disabled" } };
      const rule = { userId: id, isActive: true };
      const account = { userId: id, status: "active" };
      const decide = (u, usage, c = campaign, a = account) =>
        authorizeCommentActions({ user: u, campaign: c, rule, account: a, usage, now });
      const trial = { period: "trial", sent: 499 };
      const paid = { period: "billing", sent: 9999 };
      const paidUser = { ...user, subscriptionStatus: "active" };
      const verified = verifiedQuotaState({ userId: id, period: "trial", limit: 500,
        baselineVerified: true, baselineSource: "render-reconciliation", baselineSent: 498, reserved: 1 },
        { period: "trial", limit: 500 }, id);
      const checks = {
        trialAllowsBelow500: decide(user, trial).authorized === true,
        trialBlocksAt500: decide(user, { period: "trial", sent: 500 }).reason === "DM_QUOTA_EXHAUSTED",
        paidAllowsBelow10000: decide(paidUser, paid).authorized === true,
        paidBlocksAt10000: decide(paidUser, { period: "billing", sent: 10000 }).reason === "DM_QUOTA_EXHAUSTED",
        expiredBlocks: decide({ ...paidUser, planEndDate: new Date("2026-11-01T00:00:00Z") }, paid).reason === "SUBSCRIPTION_INACTIVE",
        ownerMismatchBlocks: decide(user, trial, campaign, { ...account, userId: "bbbbbbbbbbbbbbbbbbbbbbbb" }).reason === "OWNER_MISMATCH",
        unverifiedUsageBlocks: decide(user, { period: "trial", sent: -1 }).reason === "USAGE_UNVERIFIED",
        followGateBlocks: decide(user, trial, { ...campaign, gate: { gateType: "FOLLOW", status: "enabled" } }).reason === "FOLLOW_GATE_REQUIRED",
        verifiedBaselineIncludesReservations: verified?.sent === 499,
        missingBaselineRejected: verifiedQuotaState(null, { period: "trial", limit: 500 }, id) === null,
        forgedBaselineRejected: verifiedQuotaState({ userId: id, period: "trial", limit: 500,
          baselineVerified: true, baselineSource: "unknown", baselineSent: 0, reserved: 0 },
          { period: "trial", limit: 500 }, id) === null,
        requiresAtomicDedup: decide(user, trial).requiresDurableDeduplication === true &&
          decide(user, trial).requiresAtomicReservation === true
      };
      return json({ ok: Object.values(checks).every(Boolean), mode: "pure-read-only",
        checks, realQuotaReservationTested: false, realWebhookTested: false,
        realInstagramMessagesSent: false }, Object.values(checks).every(Boolean) ? 200 : 503);
    }
    // Read-only real staging account/campaign resolver and subscription preflight.
    // Uses existing staging documents, never posts to Meta or modifies quotas.
    if (request.method === "GET" && url.pathname === "/__cloudflare/staging-real-resolver-check") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      let client;
      try {
        const { uri, dbName } = validateStagingMongoConfig(env);
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
        await client.connect();
        const db = client.db(dbName);
        const accounts = await db.collection("instagramaccounts").find({ status: "active" })
          .project({ instagramBusinessId: 1, userId: 1 }).limit(10).toArray();
        const campaigns = await db.collection("campaigns").find({ status: "active" })
          .project({ userId: 1, instagramMediaId: 1, postIds: 1, triggerType: 1,
            ruleIds: 1, instagramAccountId: 1 }).limit(30).toArray();
        let checked = 0, resolved = 0, actionReady = 0;
        for (const account of accounts) {
          for (const campaign of campaigns) {
            if (String(account.userId) !== String(campaign.userId) ||
                !/^\d+$/.test(String(account.instagramBusinessId || ""))) continue;
            const postId = String(campaign.instagramMediaId || campaign.postIds?.[0] || "");
            if (!/^\d+$/.test(postId) || campaign.triggerType !== "specific-post") continue;
            const rules = await db.collection("rules").find({ _id: { $in: campaign.ruleIds || [] },
              userId: campaign.userId, isActive: true }).project({ triggerType: 1, triggerKeywords: 1, keywords: 1 }).toArray();
            for (const rule of rules) {
              const keyword = rule.triggerType === "any_comment" ? "test" :
                (rule.triggerKeywords || rule.keywords || []).find(k => typeof k === "string" && k.trim());
              if (!keyword) continue;
              checked++;
              const comment = { eventId: "99999999999999331", entryId: String(account.instagramBusinessId),
                postId, commentText: String(keyword), recipientId: "99999999999999332" };
              const match = await resolveStagingComment({ db, comment });
              if (match?.campaign && String(match.campaign._id) === String(campaign._id)) {
                resolved++;
                if (planCommentAutomation({ comment, campaign: match.campaign, rule: match.rule }).matched &&
                    buildCommentActionSpec({ comment, campaign: match.campaign, rule: match.rule }).ready) actionReady++;
              }
            }
          }
        }
        const userIds = [...new Set(accounts.map(a => String(a.userId)))].filter(id => /^[a-f0-9]{24}$/i.test(id));
        const users = await db.collection("users").find({ _id: { $in: userIds.map(id => new ObjectId(id)) } }).toArray();
        return json({ ok: checked > 0 && resolved > 0 && actionReady > 0,
          database: dbName, activeAccounts: accounts.length, activeCampaigns: campaigns.length,
          resolverCandidates: checked, resolved, actionSpecsReady: actionReady,
          userSubscriptionStatuses: users.map(u => ({ status: u.subscriptionStatus || "missing",
            hasTrialWindow: !!(u.trialStartDate && u.trialEndDate),
            hasBillingWindow: !!(u.subscriptionCurrentStart && (u.subscriptionCurrentEnd || u.planEndDate)) })),
          realWebhookTested: false, realInstagramMessagesSent: false });
      } catch (error) {
        console.error("Staging real resolver check failed", error?.name || "Error");
        return json({ ok: false, error: "STAGING_REAL_RESOLVER_CHECK_FAILED" }, 503);
      } finally { if (client) await client.close(); }
    }
    // Operator-only matched-event pipeline smoke test using an isolated synthetic
    // campaign/rule. It never creates a dispatchable authorization or calls Meta.
    if (request.method === "POST" && url.pathname === "/__cloudflare/staging-matched-pipeline-smoke-test") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      if (env?.ENABLE_STAGING_INSTAGRAM_SEND === "true" || env?.ENABLE_STAGING_BACKGROUND_SEND === "true") {
        return json({ ok: false, error: "SEND_MUST_BE_DISABLED" }, 409);
      }
      let client;
      try {
        const { uri, dbName } = validateStagingMongoConfig(env);
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
        await client.connect();
        const db = client.db(dbName);
        const comment = { eventId: "99999999999999231", entryId: "99999999999999232",
          postId: "99999999999999233", commentText: "guide please", username: "synthetic_test",
          recipientId: "99999999999999234" };
        const campaign = { _id: "aaaaaaaaaaaaaaaaaaaaaa31", status: "active",
          triggerType: "specific-post", instagramMediaId: comment.postId,
          settings: { enableReply: true, enableDM: true, dmMessage: "Synthetic guide DM" },
          gate: { gateType: "NONE", status: "disabled" } };
        const rule = { _id: "bbbbbbbbbbbbbbbbbbbbbb31", isActive: true,
          triggerType: "keyword", triggerKeywords: ["guide"], replies: ["Check your DM"] };
        const matched = planCommentAutomation({ comment, campaign, rule });
        const spec = buildCommentActionSpec({ comment, campaign, rule });
        if (!matched.matched || !spec.ready || spec.spec.authorized !== false) {
          return json({ ok: false, error: "PLANNING_VALIDATION_FAILED" }, 503);
        }
        const stored = await persistInstagramInbox({ env, MongoClient,
          events: { comments: [comment], postbacks: [] } });
        const key = "comment:" + comment.entryId + ":" + comment.eventId;
        const plans = db.collection("cloudflare_staging_action_plans");
        const outbox = db.collection("cloudflare_staging_action_outbox");
        await plans.updateOne({ _id: key }, { $setOnInsert: {
          plan: matched.plan, status: "awaiting_authorization", createdAt: new Date()
        } }, { upsert: true });
        const planDoc = await plans.findOne({ _id: key });
        if (planDoc?.plan?.actionsNotAuthorized !== true ||
            planDoc?.plan?.requiresSubscriptionAndQuotaCheck !== true) {
          return json({ ok: false, error: "PLAN_NOT_SAFE" }, 503);
        }
        await outbox.updateOne({ _id: key }, { $setOnInsert: {
          plan: { eventId: matched.plan.eventId, postId: matched.plan.postId,
            campaignId: matched.plan.campaignId, ruleId: matched.plan.ruleId },
          status: "awaiting_authorization", authorized: false, dispatched: false,
          createdAt: new Date()
        } }, { upsert: true });
        await db.collection("cloudflare_staging_webhook_inbox").updateOne(
          { _id: key, status: "pending" },
          { $set: { status: "planned", outcome: "REQUIRES_AUTHORIZATION",
            updatedAt: new Date() } }
        );
        const [inboxDoc, outboxDoc] = await Promise.all([
          db.collection("cloudflare_staging_webhook_inbox").findOne({ _id: key }),
          outbox.findOne({ _id: key })
        ]);
        const checks = { matchingComment: matched.matched, replyPrepared: !!spec.spec.reply,
          dmPrepared: !!spec.spec.dm, inboxPersisted: !!inboxDoc,
          planPersisted: !!planDoc, outboxPrepared: !!outboxDoc,
          authorizationBlocked: outboxDoc?.authorized === false && outboxDoc?.dispatched === false,
          inboxPlanned: inboxDoc?.status === "planned" };
        return json({ ok: Object.values(checks).every(Boolean), database: dbName,
          checks, inboxStatus: inboxDoc?.status, outboxStatus: outboxDoc?.status,
          realWebhookTested: false, realInstagramMessagesSent: false },
          Object.values(checks).every(Boolean) ? 200 : 503);
      } catch (error) {
        console.error("Matched staging pipeline smoke test failed", error?.name || "Error");
        return json({ ok: false, error: "MATCHED_PIPELINE_TEST_FAILED" }, 503);
      } finally { if (client) await client.close(); }
    }
    // Isolated synthetic inbox planning check: touches only the fixed test event.
    // Never drains unrelated pending events or creates executable actions.
    if (request.method === "POST" && url.pathname === "/__cloudflare/staging-inbox-process-smoke-test") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      if (env?.ENABLE_STAGING_INSTAGRAM_SEND === "true" || env?.ENABLE_STAGING_BACKGROUND_SEND === "true") {
        return json({ ok: false, error: "SEND_MUST_BE_DISABLED" }, 409);
      }
      let client;
      try {
        const { uri, dbName } = validateStagingMongoConfig(env);
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
        await client.connect();
        const db = client.db(dbName);
        const inbox = db.collection("cloudflare_staging_webhook_inbox");
        const key = "comment:99999999999999124:99999999999999123";
        const saved = await inbox.findOne({ _id: key });
        if (!saved) return json({ ok: false, error: "RUN_INGRESS_TEST_FIRST" }, 409);
        const resolution = await resolveStagingComment({ db, comment: saved.event });
        const decision = planCommentAutomation({
          comment: saved.event, campaign: resolution?.campaign, rule: resolution?.rule
        });
        if (decision.matched) return json({ ok: false, error: "SYNTHETIC_EVENT_UNEXPECTEDLY_MATCHED" }, 409);
        const updated = await inbox.updateOne({ _id: key, status: "pending" },
          { $set: { status: "ignored", outcome: decision.reason || "NO_MATCH",
            updatedAt: new Date() } });
        const finalRecord = await inbox.findOne({ _id: key }, { projection: { status: 1, outcome: 1 } });
        const checks = { isolatedSyntheticEvent: true, noCampaignMatched: !decision.matched,
          markedIgnored: finalRecord?.status === "ignored", sendDisabled: true };
        return json({ ok: Object.values(checks).every(Boolean), database: dbName,
          checks, inboxStatus: finalRecord?.status || null, outcome: finalRecord?.outcome || null,
          updated: updated.modifiedCount === 1, realWebhookTested: false,
          realInstagramMessagesSent: false }, Object.values(checks).every(Boolean) ? 200 : 503);
      } catch (error) {
        console.error("Staging inbox processing smoke test failed", error?.name || "Error");
        return json({ ok: false, error: "STAGING_INBOX_PROCESS_TEST_FAILED" }, 503);
      } finally { if (client) await client.close(); }
    }
    // Operator-only synthetic durable-ingress test. Fixed synthetic identifiers
    // cannot match a real Instagram account; never invokes Meta or sends messages.
    if (request.method === "POST" && url.pathname === "/__cloudflare/staging-inbox-smoke-test") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      if (env?.ENABLE_STAGING_INSTAGRAM_SEND === "true" || env?.ENABLE_STAGING_BACKGROUND_SEND === "true") {
        return json({ ok: false, error: "SEND_MUST_BE_DISABLED" }, 409);
      }
      try {
        const eventId = "99999999999999123";
        const entryId = "99999999999999124";
        const event = { comments: [{ eventId, entryId, postId: "99999999999999125",
          commentText: "synthetic staging smoke test", username: "synthetic_test",
          recipientId: "99999999999999126" }], postbacks: [] };
        const first = await persistInstagramInbox({ env, MongoClient, events: event });
        const second = await persistInstagramInbox({ env, MongoClient, events: event });
        const { uri, dbName } = validateStagingMongoConfig(env);
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
        let saved;
        try {
          await client.connect();
          saved = await client.db(dbName).collection("cloudflare_staging_webhook_inbox").findOne(
            { _id: "comment:" + entryId + ":" + eventId },
            { projection: { _id: 1, kind: 1, status: 1 } }
          );
        } finally { await client.close(); }
        const checks = { persisted: saved?.kind === "comment",
          duplicateRejected: second.inserted === 0,
          inboxRecordPresent: Boolean(saved?._id),
          sendDisabled: true };
        return json({ ok: Object.values(checks).every(Boolean), database: dbName,
          checks, inboxStatus: saved?.status || null, firstInsert: first.inserted,
          secondInsert: second.inserted, realWebhookTested: false,
          realInstagramMessagesSent: false }, Object.values(checks).every(Boolean) ? 200 : 503);
      } catch (error) {
        console.error("Synthetic staging inbox smoke test failed", error?.name || "Error");
        return json({ ok: false, error: "STAGING_INBOX_SMOKE_TEST_FAILED" }, 503);
      }
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
          const outbox = db.collection("cloudflare_staging_action_outbox");
          const [awaitingExecution, awaitingFollow, executionReview, sent] = await Promise.all([
            outbox.countDocuments({ status: "awaiting_authorization" }),
            outbox.countDocuments({ status: "awaiting_follow" }),
            outbox.countDocuments({ status: "needs_review" }),
            outbox.countDocuments({ status: { $in: ["completed", "sent"] } })
          ]);
          const flags = {
            background: env?.ENABLE_STAGING_BACKGROUND === "true",
            planner: env?.ENABLE_STAGING_PLANNER === "true",
            preparation: env?.ENABLE_STAGING_ACTION_PREPARATION === "true",
            followPostbacks: env?.ENABLE_STAGING_FOLLOW_POSTBACK_PROCESSOR === "true",
            followVerification: env?.ENABLE_STAGING_FOLLOW_VERIFICATION === "true",
            instagramSend: env?.ENABLE_STAGING_INSTAGRAM_SEND === "true",
            backgroundSend: env?.ENABLE_STAGING_BACKGROUND_SEND === "true",
            exclusiveOwnership: env?.ENABLE_STAGING_EXCLUSIVE_SEND_OWNERSHIP === "true",
            sendAccountConfigured: /^\d+$/.test(String(env?.STAGING_SEND_INSTAGRAM_BUSINESS_ID || "")),
            cutoffValid: typeof env?.STAGING_AUTOMATIC_SEND_NOT_BEFORE === "string" &&
              Number.isFinite(Date.parse(env.STAGING_AUTOMATIC_SEND_NOT_BEFORE))
          };
          const blockers = [
            ...(!flags.background ? ["BACKGROUND_DISABLED"] : []),
            ...(!flags.planner ? ["PLANNER_DISABLED"] : []),
            ...(!flags.preparation ? ["PREPARATION_DISABLED"] : []),
            ...(!flags.instagramSend ? ["INSTAGRAM_SEND_DISABLED"] : []),
            ...(!flags.backgroundSend ? ["BACKGROUND_SEND_DISABLED"] : []),
            ...(!flags.exclusiveOwnership ? ["EXCLUSIVE_OWNERSHIP_DISABLED"] : []),
            ...(!flags.sendAccountConfigured ? ["SEND_ACCOUNT_MISSING"] : []),
            ...(!flags.cutoffValid ? ["SEND_CUTOFF_INVALID"] : [])
          ];
          return json({ ok: true, database: dbName, inbox: { pending, planning, planned, ignored, needsReview },
            plans: { awaitingAuthorization }, outbox: { awaitingExecution, awaitingFollow, executionReview, sent },
            flags, blockers, instagramMessagesSent: false });
        } finally { await client.close(); }
      } catch (error) {
        console.error("Staging inbox diagnostic failed", error?.name || "Error");
        return json({ ok: false, error: "STAGING_INBOX_STATUS_UNAVAILABLE" }, 503);
      }
    }
    // Read-only staging trace of recent comment processing. Never expose account IDs,
    // comment text, recipient IDs, tokens, or trigger any Instagram action.
    if (request.method === "GET" && url.pathname === "/__cloudflare/staging-recent-action-trace") {
      if (!env?.STAGING_PROBE_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      let client;
      try {
        const { uri, dbName } = validateStagingMongoConfig(env);
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
        await client.connect();
        const db = client.db(dbName);
        const rows = await db.collection("cloudflare_staging_webhook_inbox")
          .find({ kind: "comment" }).sort({ receivedAt: -1, _id: -1 }).limit(8)
          .project({ _id: 1, receivedAt: 1, status: 1, outcome: 1 }).toArray();
        const trace = [];
        for (const row of rows) {
          const [plan, outbox, sends] = await Promise.all([
            db.collection("cloudflare_staging_action_plans").findOne({ _id: row._id }, { projection: { status: 1 } }),
            db.collection("cloudflare_staging_action_outbox").findOne({ _id: row._id }, { projection: { status: 1, reconciliationReason: 1 } }),
            db.collection("cloudflare_staging_action_sends").find({ outboxId: row._id })
              .project({ kind: 1, status: 1, errorCode: 1 }).limit(4).toArray()
          ]);
          trace.push({
            receivedAt: row.receivedAt, inboxStatus: row.status, outcome: row.outcome || null,
            planStatus: plan?.status || null, outboxStatus: outbox?.status || null,
            reconciliationReason: outbox?.reconciliationReason || null,
            sendStages: sends.map(x => ({ kind: x.kind, status: x.status,
              errorCode: x.errorCode || null }))
          });
        }
        return json({ ok: true, database: dbName, recentComments: trace, readOnly: true });
      } catch (error) {
        console.error("Staging action trace failed", error?.name || "Error");
        return json({ ok: false, error: "STAGING_TRACE_UNAVAILABLE" }, 503);
      } finally { if (client) await client.close(); }
    }
    // Native staging deletion; remove the owned automation and its linked records.
    if (request.method === "DELETE" && /^\/(?:api\/)?automations\/[a-f0-9]{24}$/i.test(url.pathname)) {
      if (!env?.STAGING_JWT_SECRET) return json({ message: "Staging automations unavailable" }, 503);
      const authorization = request.headers.get("Authorization") || "";
      if (!authorization.startsWith("Bearer ")) return json({ message: "No token provided" }, 401);
      let userId;
      try { userId = getTriggerDmUserId(await verifySessionJwt(authorization.slice(7), env.STAGING_JWT_SECRET)); }
      catch { return json({ message: "Invalid token" }, 401); }
      try {
        const result = await stagingAutomations({ env, MongoClient, authenticatedUserId: userId,
          method: "DELETE", automationId: url.pathname.split("/").at(-1) });
        return json(result.body, result.status);
      } catch (error) {
        console.error("Staging automation delete failed", error?.name || "Error");
        return json({ message: "Staging automations unavailable" }, 503);
      }
    }
    // Native staging automation editing; same authenticated staging DB as creation.
    if (request.method === "PUT" && /^\/(?:api\/)?automations\/[a-f0-9]{24}$/i.test(url.pathname)) {
      if (!env?.STAGING_JWT_SECRET) return json({ message: "Staging automations unavailable" }, 503);
      const authorization = request.headers.get("Authorization") || "";
      if (!authorization.startsWith("Bearer ")) return json({ message: "No token provided" }, 401);
      let userId;
      try { userId = getTriggerDmUserId(await verifySessionJwt(authorization.slice(7), env.STAGING_JWT_SECRET)); }
      catch { return json({ message: "Invalid token" }, 401); }
      let input;
      try {
        const raw = await request.text();
        if (raw.length > 16384) return json({ message: "Payload too large" }, 413);
        input = JSON.parse(raw);
      } catch { return json({ message: "Invalid JSON" }, 400); }
      try {
        const result = await stagingAutomations({ env, MongoClient, authenticatedUserId: userId,
          method: "PUT", automationId: url.pathname.split("/").at(-1), input });
        return json(result.body, result.status);
      } catch (error) {
        console.error("Staging automation edit failed", error?.name || "Error");
        return json({ message: "Staging automations unavailable" }, 503);
      }
    }
    // Native staging automation list/create, isolated from Render rate limits.
    if (["GET", "POST"].includes(request.method) &&
        ["/automations", "/api/automations"].includes(url.pathname)) {
      if (!env?.STAGING_JWT_SECRET) return json({ success: false, message: "Staging automations unavailable" }, 503);
      const authorization = request.headers.get("Authorization") || "";
      if (!authorization.startsWith("Bearer ")) return json({ success: false, message: "No token provided" }, 401);
      let userId;
      try { userId = getTriggerDmUserId(await verifySessionJwt(authorization.slice(7), env.STAGING_JWT_SECRET)); }
      catch { return json({ success: false, message: "Invalid token" }, 401); }
      let input;
      if (request.method === "POST") {
        try {
          const raw = await request.text();
          if (raw.length > 16384) return json({ success: false, message: "Payload too large" }, 413);
          input = JSON.parse(raw);
        } catch { return json({ success: false, message: "Invalid JSON" }, 400); }
      }
      try {
        const result = await stagingAutomations({ env, MongoClient, authenticatedUserId: userId, method: request.method, input });
        return json(result.body, result.status);
      } catch (error) {
        console.error("Staging automation operation failed", error?.name || "Error");
        return json({ success: false, message: "Staging automations unavailable" }, 503);
      }
    }
    // Native read-only staging Instagram media route, avoiding Render upstream limits.
    if (request.method === "GET" && ["/instagram/media", "/api/instagram/media"].includes(url.pathname)) {
      if (!env?.STAGING_JWT_SECRET) return json({ success: false, message: "Staging media unavailable" }, 503);
      const authorization = request.headers.get("Authorization") || "";
      if (!authorization.startsWith("Bearer ")) return json({ success: false, message: "No token provided" }, 401);
      let userId;
      try { userId = getTriggerDmUserId(await verifySessionJwt(authorization.slice(7), env.STAGING_JWT_SECRET)); }
      catch { return json({ success: false, message: "Invalid token" }, 401); }
      try {
        const result = await listStagingInstagramMedia({ env, MongoClient, authenticatedUserId: userId, search: url.searchParams.get("search") || "" });
        return json(result.body, result.status);
      } catch (error) {
        console.error("Staging media listing failed", error?.name || "Error");
        return json({ success: false, message: "Staging media unavailable" }, 503);
      }
    }
    // Native staging account listing: avoids rate-limited Render upstream.
    // Authenticated, read-only and strictly scoped to triggerdm_staging.
    if (request.method === "GET" && ["/instagram/accounts", "/api/instagram/accounts"].includes(url.pathname)) {
      if (!env?.STAGING_JWT_SECRET) return json({ success: false, message: "Staging accounts unavailable" }, 503);
      const authorization = request.headers.get("Authorization") || "";
      if (!authorization.startsWith("Bearer ")) return json({ success: false, message: "No token provided" }, 401);
      let userId;
      try { userId = getTriggerDmUserId(await verifySessionJwt(authorization.slice(7), env.STAGING_JWT_SECRET)); }
      catch { return json({ success: false, message: "Invalid token" }, 401); }
      try {
        const accounts = await listStagingInstagramAccounts({ env, MongoClient, authenticatedUserId: userId });
        return json({ success: true, data: accounts });
      } catch (error) {
        console.error("Staging account listing failed", error?.name || "Error");
        return json({ success: false, message: "Staging accounts unavailable" }, 503);
      }
    }
    // Native staging login canary; disabled until isolated credentials are configured.
    if (["/api/auth/login", "/auth/login"].includes(url.pathname) && request.method === "POST" && env?.ENABLE_NATIVE_STAGING_LOGIN === "true") {
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
    if (["/api/auth/me", "/auth/me"].includes(url.pathname) && request.method === "GET" && env?.ENABLE_NATIVE_STAGING_AUTH_ME === "true") {
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
        if (["INVALID_RULE", "INVALID_RULE_FIELD", "CONFLICTING_KEYWORDS"].includes(error?.message)) return json({ message: "Invalid rule fields" }, 400);
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
        if (["INVALID_RULE", "INVALID_RULE_FIELD", "CONFLICTING_KEYWORDS"].includes(error?.message)) return json({ message: "Invalid rule fields" }, 400);
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
    // Protected staging-only action preparation. No Graph calls or queue sends.
    if (url.pathname === "/__cloudflare/staging-prepare-actions" && request.method === "POST") {
      if (env?.ENABLE_STAGING_ACTION_PREPARATION !== "true" || !env?.STAGING_PROBE_TOKEN ||
          request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      try {
        const result = await prepareStagingActionOutbox({ env, MongoClient, limit: 10 });
        return json({ ok: true, ...result });
      } catch (error) {
        console.error("Staging action preparation failed", error?.name || "Error");
        return json({ error: "Staging action preparation unavailable" }, 503);
      }
    }
    // Operator-only verification of one already-prompted real Instagram comment.
    // Meta is the sole authority for follower status. No direct send here;
    // the existing at-most-once executor performs the DM after verification.
    if (request.method === "POST" && url.pathname === "/__cloudflare/staging-verify-follow") {
      if (!env?.STAGING_PROBE_TOKEN ||
          request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN ||
          env?.ENABLE_STAGING_INSTAGRAM_SEND !== "true") return json({ error: "Not found" }, 404);
      let client;
      try {
        const body = await request.json();
        const commentId = String(body?.commentId || "");
        if (!/^\d{8,30}$/.test(commentId)) return json({ ok: false, error: "INVALID_COMMENT_ID" }, 400);
        const { uri, dbName } = validateStagingMongoConfig(env);
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
        await client.connect();
        const db = client.db(dbName);
        const accountId = String(env?.STAGING_SEND_INSTAGRAM_BUSINESS_ID || "");
        if (!/^\d+$/.test(accountId)) return json({ ok: false, error: "STAGING_ACCOUNT_NOT_APPROVED" }, 409);
        const inboxId = "comment:" + accountId + ":" + commentId;
        const sessionId = "follow:" + inboxId;
        const [session, outbox, inbox] = await Promise.all([
          db.collection("cloudflare_staging_follow_gate_sessions").findOne({ _id: sessionId }),
          db.collection("cloudflare_staging_action_outbox").findOne({ _id: inboxId }),
          db.collection("cloudflare_staging_webhook_inbox").findOne({ _id: inboxId })
        ]);
        if (!session || !outbox || !inbox ||
            session.inboxId !== inboxId || session.commentId !== commentId ||
            String(session.recipientId) !== String(inbox.event?.recipientId) ||
            outbox.status !== "awaiting_follow" ||
            !["WAITING", "VERIFIED"].includes(session.status)) {
          return json({ ok: false, error: "NO_WAITING_FOLLOW_GATE_FOR_COMMENT" }, 409);
        }
        if (!/^[a-f0-9]{24}$/i.test(String(session.userId || ""))) {
          return json({ ok: false, error: "INVALID_SESSION_OWNER" }, 409);
        }
        const account = await db.collection("instagramaccounts").findOne({
          instagramBusinessId: accountId, userId: new ObjectId(String(session.userId)),
          status: "active"
        });
        if (!account?.accessToken) return json({ ok: false, error: "ACCOUNT_UNAVAILABLE" }, 409);
        const follower = await getInstagramFollowerStatus({
          accessToken: account.accessToken, instagramScopedUserId: session.recipientId, fetchImpl: fetch
        });
        if (follower.followsBusiness !== true) {
          return json({ ok: false, error: "FOLLOW_NOT_VERIFIED_BY_META" }, 409);
        }
        const verification = session.status === "VERIFIED"
          ? { unlocked: true, alreadyVerified: true }
          : await confirmFollowGate({ db, sessionId, followerStatus: true,
              senderId: session.recipientId, accountId });
        if (!verification.unlocked) return json({ ok: false, error: "FOLLOW_SESSION_NOT_UNLOCKED" }, 409);
        return json({ ok: true, commentId, verifiedByMeta: true,
          unlocked: true, next: "/__cloudflare/staging-execute-actions", instagramMessagesSent: false });
      } catch (error) {
        console.error("Staging follow verification failed", error?.name || "Error");
        return json({ ok: false, error: "FOLLOW_VERIFICATION_UNAVAILABLE" }, 503);
      } finally { if (client) await client.close(); }
    }
    // Operator-only staging executor. Explicitly disabled by default. Never
    // enable until staging end-to-end tests and manual reconciliation are ready.
    if (url.pathname === "/__cloudflare/staging-execute-actions" && request.method === "POST") {
      if (env?.ENABLE_STAGING_INSTAGRAM_SEND !== "true" || !env?.STAGING_PROBE_TOKEN ||
          request.headers.get("Authorization") !== "Bearer " + env.STAGING_PROBE_TOKEN) {
        return json({ error: "Not found" }, 404);
      }
      try {
        const result = await executeStagingActions({ env, MongoClient, fetchImpl: fetch, limit: 5 });
        return json({ ok: true, ...result });
      } catch (error) {
        console.error("Staging action execution failed", error?.name || "Error");
        return json({ error: "Staging action execution unavailable" }, 503);
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
      // Mirrored ingress must never import unrelated production accounts.
      // Keep sending separately disabled until Render/Cloudflare ownership is exclusive.
      const approvedAccount = String(env?.STAGING_SEND_INSTAGRAM_BUSINESS_ID || "");
      if (!/^\d+$/.test(approvedAccount)) return json({ error: "Staging account allowlist required" }, 503);
      events = mapApprovedStagingWebhookEvents(events, env);
      try {
        const result = await persistInstagramInbox({ env, MongoClient, events });
        if (result.inserted > 0 && env?.ENABLE_STAGING_BACKGROUND === "true" && ctx?.waitUntil) {
          ctx.waitUntil(drainStagingInbox({ env, MongoClient }).catch(error => {
            console.error("Staging mirrored ingress drain failed", error?.name || "Error");
          }));
        }
        return json({ ok: true, received: result.received, inserted: result.inserted });
      } catch (error) {
        // Malformed input is not a database outage. Return a client error while
        // keeping credentials, payloads and database internals out of responses.
        if (["INVALID_EVENTS", "TOO_MANY_EVENTS", "INVALID_COMMENT_ID", "INVALID_COMMENT_SOURCE"].includes(error?.message)) {
          return json({ error: "Invalid Instagram events" }, 400);
        }
        console.error("Staging inbox write failed", error?.name || "Error");
        return json({ error: "Durable staging storage unavailable" }, 503);
      }
    }
    // Native staging Razorpay billing: JWT authenticated and fail-closed.
    if (["/billing/create-subscription", "/api/billing/create-subscription",
         "/billing/history", "/api/billing/history",
         "/billing/reconcile", "/api/billing/reconcile"].includes(url.pathname)) {
      if (env?.ENABLE_STAGING_RAZORPAY !== "true") return json({ error: "Not found" }, 404);
      const bearer = request.headers.get("Authorization") || "";
      if (!bearer.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      let userId;
      try {
        userId = getTriggerDmUserId(await verifySessionJwt(bearer.slice(7), env.STAGING_JWT_SECRET));
      } catch { return json({ error: "Unauthorized" }, 401); }
      try {
        if (url.pathname.endsWith("/create-subscription") && request.method === "POST") {
          const result = await createStagingSubscription({ env, MongoClient, userId, fetchImpl: fetch });
          return json(result.data, result.status);
        }
        if (url.pathname.endsWith("/reconcile") && request.method === "POST") {
          const result = await reconcileStagingSubscription({ env, MongoClient, userId, fetchImpl: fetch });
          return json(result.data, result.status);
        }
        if (url.pathname.endsWith("/history") && request.method === "GET") {
          return json(await stagingPaymentHistory({ env, MongoClient, userId }));
        }
        return json({ error: "Method not allowed" }, 405);
      } catch (error) {
        console.error("Staging Razorpay API failed", error?.message === "RAZORPAY_API_UNAVAILABLE" ?
          "RAZORPAY_API_UNAVAILABLE" : error?.name || "Error");
        return json({ success: false, message: "Billing temporarily unavailable" }, 503);
      }
    }
    // Native staging referrals and payout endpoints. Never fall through to Render.
    const referralPath = url.pathname.replace(/^\/api\//, "/");
    if (referralPath === "/referrals/summary" ||
        referralPath === "/referrals/payouts/requests" ||
        referralPath === "/referrals/payouts/admin/requests" ||
        /^\/referrals\/payouts\/admin\/requests\/[a-f0-9]{24}$/i.test(referralPath)) {
      if (env?.ENABLE_STAGING_REFERRALS !== "true") return json({ error: "Not found" }, 404);
      const bearer = request.headers.get("Authorization") || "";
      if (!bearer.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      let userId;
      try { userId = getTriggerDmUserId(await verifySessionJwt(bearer.slice(7), env.STAGING_JWT_SECRET)); }
      catch { return json({ error: "Unauthorized" }, 401); }
      try {
        if (referralPath === "/referrals/summary" && request.method === "GET")
          { const result = await referralSummary({ env, MongoClient, userId }); return json(result.data, result.status); }
        const admin = referralPath.includes("/admin/");
        const payoutId = admin && referralPath.split("/").length === 6 ? referralPath.split("/").at(-1) : null;
        const body = request.method === "PATCH" ? await request.json().catch(() => null) : null;
        const result = await payoutRequests({ env, MongoClient, userId, method: request.method, body, admin, payoutId });
        return json(result.data, result.status);
      } catch (error) {
        console.error("Staging referral route failed", error?.name || "Error");
        return json({ success: false, message: "Referral service temporarily unavailable" }, 503);
      }
    }
    // Razorpay webhooks are never proxied; only acknowledge after durable processing.
    if (url.pathname === "/api/billing/razorpay-webhook" && request.method === "POST") {
      if (env?.ENABLE_STAGING_RAZORPAY !== "true") return json({ error: "Not found" }, 404);
      try {
        const result = await processStagingRazorpayWebhook({ request, env, MongoClient, fetchImpl: fetch });
        return json(result.data, result.status);
      } catch (error) {
        console.error("Staging Razorpay webhook failed", error?.name || "Error");
        return json({ success: false, message: "Webhook processing unavailable" }, 503);
      }
    }
    // Never proxy webhook traffic during migration. A suspended upstream can
    // respond unpredictably, and accepting payments/comments without durable
    // processing would cause silent loss. Handle signature checks locally.
    const isWebhook = url.pathname === "/api/webhook/instagram" ||
      url.pathname === "/api/billing/razorpay-webhook";
    if (env?.UPSTREAM_ORIGIN && !isWebhook) {
      // Staging frontend uses paths without /api. Normalize only known API
      // namespaces; keep Cloudflare diagnostics and webhook routes isolated.
      const aliases = /^\/(auth|rules|campaigns|instagram|automations|analytics|billing|referrals|follow|health|admin|trend|campaign-health|simulate|test)(\/|$)/;
      if (aliases.test(url.pathname)) {
        const upstreamUrl = new URL(request.url);
        upstreamUrl.pathname = "/api" + url.pathname;
        return proxyRequest(new Request(upstreamUrl, request), env);
      }
      return proxyRequest(request, env);
    }
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
        // Explicit opt-in only for a separate STAGING Meta app/callback.
        // Durable inbox write precedes acknowledgment. Production remains on Render.
        if (env?.ENABLE_NATIVE_STAGING_META_WEBHOOK !== "true") {
          return json({ error: "Webhook processing not migrated; do not configure Meta callback here" }, 501);
        }
        try {
          const extracted = extractInstagramEvents(JSON.parse(rawBody));
          const approvedAccount = String(env?.STAGING_SEND_INSTAGRAM_BUSINESS_ID || "");
          if (!/^\d+$/.test(approvedAccount)) return json({ error: "Staging account allowlist required" }, 503);
          const events = mapApprovedStagingWebhookEvents(extracted, env);
          const stored = await persistInstagramInbox({ env, MongoClient, events });
          // Only process after durable storage, and only with the staging
          // pipeline explicitly enabled. The provider acknowledgment does not
          // depend on Graph delivery, which can be retried/reconciled separately.
          if (stored.inserted > 0 && env?.ENABLE_STAGING_BACKGROUND === "true" && ctx?.waitUntil) {
            // Acknowledge Meta once Mongo has durably accepted the event.
            // Process asynchronously: Graph latency must not trigger Meta retries.
            ctx.waitUntil(drainStagingInbox({ env, MongoClient }).catch(error => {
              console.error("Staging webhook background drain failed", error?.name || "Error");
            }));
          }
          return json({ ok: true, received: stored.received, inserted: stored.inserted });
        } catch (error) {
          console.error("Native staging webhook persistence failed", error?.name || "Error");
          return json({ error: "Durable webhook persistence unavailable" }, 503);
        }
      }
    }
    return json({ error: "Not implemented: migration in progress" }, 501);
  },
};
