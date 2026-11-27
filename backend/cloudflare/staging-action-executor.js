// Staging-only execution coordinator. Every external send is at-most-once:
// an uncertain network result remains "sending" for manual reconciliation,
// never retried blindly. Production callbacks are NOT routed here.
import { ObjectId } from "mongodb";

import { verifiedFollowGateRelease } from "./follow-gate-release.js";
import { startFollowGate } from "./follow-gate-state.js";
import { buildFollowPrompt } from "./follow-gate-prompt.js";
import { automationRuntime } from "./automation-runtime.js";
import { authorizeCommentActions } from "./automation-authorization.js";
import { buildCommentActionSpec } from "./comment-action-spec.js";
import { replyToInstagramComment, sendInstagramDM, getInstagramFollowerStatus } from "./instagram-graph.js";

const objectId = value => /^[a-f\d]{24}$/i.test(String(value || "")) ? new ObjectId(String(value)) : null;
const numberId = value => /^\d+$/.test(String(value || ""));
function usagePeriod(user, now) {
  if (user.subscriptionStatus === "trial") {
    if (!user.trialStartDate || !user.trialEndDate || new Date(user.trialStartDate) > now || new Date(user.trialEndDate) <= now) return null;
    return { period: "trial", start: new Date(user.trialStartDate), key: "trial:" + String(user.trialStartDate), limit: 500 };
  }
  const start = user.subscriptionCurrentStart;
  const end = user.subscriptionCurrentEnd || user.planEndDate;
  if (!start || !end || new Date(start) > now || new Date(end) <= now) return null;
  return { period: "billing", start: new Date(start), key: "billing:" + new Date(start).toISOString(), limit: 10000 };
}
export async function executeStagingActions({ env, MongoClient, fetchImpl, getFollower = getInstagramFollowerStatus, limit = 5, now = new Date(), receivedNotBefore = null, followInboxId }) {
  const { uri, dbName, production, prefix } = automationRuntime(env);
  if (receivedNotBefore !== null && (!(receivedNotBefore instanceof Date) || !Number.isFinite(receivedNotBefore.getTime()))) throw new Error("INVALID_AUTOMATIC_SEND_CUTOFF");
  if (production && (!receivedNotBefore || env.ENABLE_PRODUCTION_INSTAGRAM_SEND !== "true")) {
    throw new Error("PRODUCTION_SEND_DISABLED");
  }
  if (!production && env?.ENABLE_STAGING_INSTAGRAM_SEND !== "true") throw new Error("STAGING_SEND_DISABLED");
  // Explicitly bind live staging sends to one operator-approved Instagram
  // account. An enabled flag alone must never send for every copied account.
  if (!production && !/^\d+$/.test(String(env?.STAGING_SEND_INSTAGRAM_BUSINESS_ID || ""))) {
    throw new Error("STAGING_SEND_ACCOUNT_NOT_APPROVED");
  }
  if (typeof MongoClient !== "function" || typeof fetchImpl !== "function") throw new TypeError("DEPENDENCIES_REQUIRED");
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new RangeError("INVALID_LIMIT");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  const summary = { inspected: 0, completed: 0, blocked: 0, uncertain: 0 };
  const blockedReasons = {};
  const block = reason => {
    summary.blocked++;
    if (production) blockedReasons[reason] = (blockedReasons[reason] || 0) + 1;
  };
  try {
    await client.connect();
    const db = client.db(dbName);
    const outbox = db.collection(prefix + "_action_outbox");
    const sends = db.collection(prefix + "_action_sends");
    const quotas = db.collection(prefix + "_dm_quotas");
    // Filter eligible inbox IDs before limiting outbox rows. Otherwise the oldest
    // pre-cutoff rows occupy every slot forever and starve fresh automatic events.
    const eligibleInboxIds = receivedNotBefore && !production
      ? (await db.collection(prefix + "_webhook_inbox")
          .find({ kind: "comment", status: "planned", receivedAt: { $gte: receivedNotBefore } })
          .project({ _id: 1 }).limit(100).toArray()).map(row => row._id)
      : null;
    const cursor = outbox.find({
      ...(followInboxId
        ? { _id: followInboxId, status: "awaiting_follow" }
        : { status: { $in: ["awaiting_authorization", "awaiting_follow"] } }),
      authorized: false,
      ...(eligibleInboxIds ? { _id: { $in: eligibleInboxIds } } : {}),
      ...(production ? { receivedAt: { $gte: receivedNotBefore } } : {})
    }).sort(production ? { lastInspectedAt: 1, createdAt: 1, _id: 1 } : { createdAt: 1, _id: 1 }).limit(limit);
    for await (const item of cursor) {
      summary.inspected++;
      if (production) {
        await outbox.updateOne({ _id: item._id, status: item.status },
          { $set: { lastInspectedAt: now } });
      }
      const plan = item.plan;
      if (!plan || !numberId(plan.eventId) || !numberId(plan.postId) ||
          !objectId(plan.campaignId) || !objectId(plan.ruleId)) { summary.blocked++; continue; }
      const inbox = await db.collection(prefix + "_webhook_inbox").findOne({ _id: item._id, status: "planned" });
      if (receivedNotBefore && (!(inbox?.receivedAt instanceof Date) || inbox.receivedAt < receivedNotBefore)) { summary.blocked++; continue; }
      if (!inbox || inbox.event?.eventId !== plan.eventId || inbox.event?.postId !== plan.postId ||
          !numberId(inbox.event?.entryId)) { summary.blocked++; continue; }
      const campaign = await db.collection("campaigns").findOne({ _id: objectId(plan.campaignId), status: "active" });
      const rule = await db.collection("rules").findOne({ _id: objectId(plan.ruleId), isActive: true });
      if (!campaign || !rule || String(campaign.userId) !== String(rule.userId) ||
          !Array.isArray(campaign.ruleIds) || !campaign.ruleIds.some(id => String(id) === String(rule._id))) {
        summary.blocked++; continue;
      }
      const account = await db.collection("instagramaccounts").findOne({
        instagramBusinessId: String(inbox.event.entryId), userId: campaign.userId, status: "active"
      });
      const user = await db.collection("users").findOne({ _id: campaign.userId });
      if (!account || !user || !account.accessToken || (campaign.settings?.enableDM !== false && !account.pageAccessToken)) { block("ACCOUNT_CONTEXT_UNAVAILABLE"); continue; }
      const receivedTimestamp = inbox.event.commentTimestamp;
      if (production && receivedTimestamp) {
        const numeric = Number(receivedTimestamp);
        const timestamp = Number.isFinite(numeric)
          ? numeric * (numeric < 1e12 ? 1000 : 1)
          : Date.parse(receivedTimestamp);
        if (!Number.isFinite(timestamp) || timestamp < now.getTime() - 6 * 86400000) {
          await outbox.updateOne({ _id: item._id, status: item.status },
            { $set: { status: "ignored", reconciliationReason: "COMMENT_EXPIRED" } });
          summary.blocked++; continue;
        }
      }
      if (production && (String(inbox.userId) !== String(user._id) ||
          String(inbox.accountId) !== String(account.instagramBusinessId) ||
          String(item._id) !== "comment:" + account.instagramBusinessId + ":" + plan.eventId ||
          await db.collection("processedevents").findOne({ eventId: plan.eventId }))) {
        summary.blocked++; continue;
      }
      if (!production && String(account.instagramBusinessId) !== String(env.STAGING_SEND_INSTAGRAM_BUSINESS_ID)) {
        summary.blocked++; continue;
      }
      if (campaign.instagramAccountId && String(campaign.instagramAccountId) !== String(account.instagramBusinessId)) {
        summary.blocked++; continue;
      }
      if (campaign.triggerType === "next-post" &&
          ![campaign.instagramMediaId, ...(campaign.postIds || [])].some(id => String(id) === plan.postId)) {
        summary.blocked++; continue;
      }
      if (campaign.triggerType === "specific-post" &&
          ![campaign.instagramMediaId, ...(campaign.postIds || [])].some(id => String(id) === plan.postId)) {
        summary.blocked++; continue;
      }
      const keyword = rule.triggerType === "any_comment" ||
        (rule.triggerType === "keyword" &&
        (Array.isArray(rule.triggerKeywords) ? rule.triggerKeywords : rule.keywords || [])
          .some(k => typeof k === "string" && k.trim() &&
            String(inbox.event.commentText || "").toLowerCase().includes(k.trim().toLowerCase())));
      if (!keyword) { summary.blocked++; continue; }
      const action = buildCommentActionSpec({ comment: inbox.event, campaign, rule });
      if (!action.ready) { block(action.reason); continue; }
      let followGateVerified = false;
      let followPrompt = null;
      if (action.spec.followGateRequired) {
        if (production && env.ENABLE_PRODUCTION_FOLLOW_GATE !== "true") { block("FOLLOW_GATE_DISABLED"); continue; }
        const session = await db.collection(prefix + "_follow_gate_sessions").findOne({
          _id: "follow:" + String(item._id), status: "VERIFIED"
        });
        const release = verifiedFollowGateRelease({
          session, inboxId: item._id, campaignId: campaign._id, userId: user._id,
          recipientId: inbox.event.recipientId, commentId: plan.eventId
        });
        if (release.allowed) {
          if (production && (!(session.verifiedAt instanceof Date) ||
              now.getTime() - session.verifiedAt.getTime() >= 23 * 3600000)) {
            summary.blocked++; continue;
          }
          followGateVerified = true;
        } else if (item.status === "awaiting_authorization" && !session) {
          if (!numberId(inbox.event.recipientId)) { block("FOLLOW_RECIPIENT_MISSING"); continue; }
          // Never infer follower status from a button click or local data.
          // An unavailable Meta status blocks the send rather than bypassing the gate.
          let follows;
          try {
            const result = await getFollower({
              accessToken: production ? account.pageAccessToken || account.accessToken : account.accessToken,
              instagramScopedUserId: inbox.event.recipientId, fetchImpl
            });
            follows = result?.followsBusiness;
          } catch { block("META_FOLLOW_STATUS_UNAVAILABLE"); continue; }
          if (follows === true) {
            followGateVerified = true;
          } else if (follows === false && account.username) {
            try {
              followPrompt = buildFollowPrompt({
                sessionId: "follow:" + String(item._id),
                profileUrl: "https://www.instagram.com/" + String(account.username) + "/",
                openingMessage: campaign.gate.openingMessage
              });
            } catch { block("FOLLOW_PROMPT_INVALID"); continue; }
          } else { block("FOLLOW_PROMPT_CONTEXT_MISSING"); continue; }
        } else { summary.blocked++; continue; }
      }
      const period = usagePeriod(user, now);
      if (!period && action.spec.dm) { block("USAGE_PERIOD_UNAVAILABLE"); continue; }
      if (item.status === "awaiting_follow" && !followGateVerified) { summary.blocked++; continue; }
      const quotaId = period ? String(user._id) + ":" + period.key : null;
      // Owner-approved fresh allowance for the existing subscription period.
      // Atomic setOnInsert never resets an existing Cloudflare counter.
      const newPeriod = production && period?.start >= receivedNotBefore;
      if (action.spec.dm && (!production || newPeriod || env.PRODUCTION_DM_QUOTA_POLICY === "fresh-start")) {
        await quotas.updateOne({ _id: quotaId }, { $setOnInsert: {
          userId: user._id, period: period.period, limit: period.limit,
          baselineSent: 0, reserved: 0, baselineVerified: true,
          baselineSource: newPeriod ? "period-started-after-cutover" : "fresh-start-owner-approved", createdAt: new Date()
        } }, { upsert: true });
      }
      const counter = quotaId ? await quotas.findOne({ _id: quotaId }) : null;
      const validCounter = counter && String(counter.userId) === String(user._id) &&
        counter.period === period?.period && counter.limit === period?.limit &&
        counter.baselineVerified === true &&
        ["fresh-start-owner-approved", "render-reconciliation", "period-started-after-cutover"].includes(counter.baselineSource) &&
        Number.isSafeInteger(counter.baselineSent) && counter.baselineSent >= 0 &&
        Number.isSafeInteger(counter.reserved) && counter.reserved >= 0 &&
        counter.baselineSent + counter.reserved <= period.limit;
      if (action.spec.dm && !validCounter) { block("QUOTA_COUNTER_UNVERIFIED"); continue; }
      const usage = { period: period?.period || "billing",
        sent: validCounter ? counter.baselineSent + counter.reserved : 0 };
      // A prompt is allowed after subscription/quota checks, not gated content.
      const authorization = authorizeCommentActions({ user, campaign, rule, account, usage,
        followGateVerified: followGateVerified || Boolean(followPrompt), now });
      if (!authorization.authorized) { block(authorization.reason); continue; }
      // Atomically claim this outbox row before any provider call. Two Worker
      // invocations must never concurrently send actions for the same comment.
      if (followPrompt) {
        await startFollowGate({ db, inboxId: String(item._id),
          campaignId: String(campaign._id), userId: String(user._id),
          recipientId: String(inbox.event.recipientId), commentId: String(plan.eventId),
          sessionsCollection: prefix + "_follow_gate_sessions" });
      }
      const claim = await outbox.updateOne({ _id: item._id, status: item.status, authorized: false },
        { $set: { status: "executing", executionStartedAt: new Date() } });
      if (claim.modifiedCount !== 1) { summary.blocked++; continue; }
      // A claim is permanently consumed once an external request starts.
      // This prevents duplicate sends when a Worker crashes after Graph accepts it.
      const stages = followPrompt
        ? [["reply", action.spec.reply], ["gate_prompt", followPrompt]]
        : [["reply", item.status === "awaiting_follow" ? null : action.spec.reply], ["dm", action.spec.dm]];
      for (const [kind, details] of stages) {
        if (!details) continue;
        const sendId = String(item._id) + ":" + kind;
        const existing = await sends.findOne({ _id: sendId });
        if (existing) {
          if (existing.status === "sent") continue;
          summary.uncertain++; break;
        }
        let reserved = false;
        if (kind === "dm") {
          // Ensure quota document exists, then atomically reserve one slot.
          const updated = await quotas.updateOne({ _id: quotaId, baselineVerified: true,
            baselineSource: counter.baselineSource, userId: user._id, period: period.period,
            limit: period.limit, baselineSent: counter.baselineSent,
            reserved: { $lte: period.limit - counter.baselineSent - 1 } },
            { $inc: { reserved: 1 } });
          if (updated.modifiedCount !== 1) { summary.blocked++; break; }
          reserved = true;
        }
        // Unique _id prevents duplicate claims; if claim fails after reservation,
        // compensate the quota reservation. Never compensate after a send starts.
        try {
          await sends.insertOne({ _id: sendId, outboxId: item._id, kind, status: "sending",
            quotaId: reserved ? quotaId : null, startedAt: new Date() });
        } catch (error) {
          if (reserved) await quotas.updateOne({ _id: quotaId }, { $inc: { reserved: -1 } });
          if (error?.code !== 11000) throw error;
          summary.uncertain++; break;
        }
        try {
          const providerStartedAt = Date.now();
          const result = kind === "reply"
            ? await replyToInstagramComment({ accessToken: account.accessToken, commentId: plan.eventId,
                message: details.message, fetchImpl })
            : await sendInstagramDM({ accessToken: account.pageAccessToken, instagramBusinessId: account.instagramBusinessId,
                ...(kind === "gate_prompt" ? { commentId: plan.eventId } :
                  action.spec.followGateRequired && (!production || item.status === "awaiting_follow") ? { recipientId: inbox.event.recipientId } : { commentId: plan.eventId }),
                message: kind === "gate_prompt" ? details.text : details.message,
                buttons: details.buttons, fetchImpl });
          const completedAt = new Date();
          if (production && kind !== "reply") {
            console.info("Production Instagram DM accepted timing", {
              kind,
              providerMs: completedAt.getTime() - providerStartedAt,
              sinceCommentIntakeMs: completedAt.getTime() - inbox.receivedAt.getTime()
            });
          }
          const sent = { status: "sent", providerId: result.id || result.messageId, completedAt };
          if (production) {
            const session = client.startSession();
            try {
              await session.withTransaction(async () => {
                const written = await sends.updateOne({ _id: sendId, status: "sending" }, { $set: sent }, { session });
                if (written.modifiedCount !== 1) throw new Error("SEND_STATE_CONFLICT");
                await db.collection("actionlogs").updateOne({ eventId: plan.eventId, actionType: kind },
                  { $setOnInsert: { eventId: plan.eventId, actionType: kind, campaignId: campaign._id,
                    ruleId: String(rule._id), userId: String(user._id), createdAt: completedAt },
                  $set: { status: "success", metricsUpdated: true, updatedAt: completedAt } }, { upsert: true, session });
                if (kind !== "gate_prompt") {
                  await db.collection("campaigns").updateOne({ _id: campaign._id, userId: user._id },
                    { $inc: { [kind === "reply" ? "metrics.repliesSent" : "metrics.dmsSent"]: 1 } }, { session });
                }
              });
            } finally {
              await session.endSession();
            }
          } else {
            await sends.updateOne({ _id: sendId, status: "sending" }, { $set: sent });
          }
        } catch (error) {
          // A timeout or Graph error may still have sent the message.
          await sends.updateOne({ _id: sendId, status: "sending" },
            { $set: { status: "needs_review", errorCode: String(error?.message || "UNKNOWN").slice(0, 80) } });
          summary.uncertain++;
          break;
        }
      }
      const required = followPrompt
        ? [action.spec.reply && "reply", "gate_prompt"].filter(Boolean)
        : [action.spec.reply && "reply", action.spec.dm && "dm"].filter(Boolean);
      const states = await Promise.all(required.map(kind => sends.findOne({ _id: String(item._id) + ":" + kind })));
      if (states.length && states.every(state => state?.status === "sent")) {
        const update = { $set: followPrompt
          ? { status: "awaiting_follow", dispatched: false, gatePromptSentAt: new Date() }
          : { status: "completed", dispatched: true, completedAt: new Date() } };
        if (production && item.status !== "awaiting_follow") {
          const session = client.startSession();
          try {
            await session.withTransaction(async () => {
              const written = await outbox.updateOne({ _id: item._id, status: "executing" }, update, { session });
              if (written.modifiedCount !== 1) throw new Error("OUTBOX_STATE_CONFLICT");
              await db.collection("campaigns").updateOne({ _id: campaign._id, userId: user._id },
                { $inc: { "metrics.commentsProcessed": 1 } }, { session });
            });
          } finally { await session.endSession(); }
        } else {
          await outbox.updateOne({ _id: item._id, status: "executing" }, update);
        }
        summary.completed++;
      } else {
        // Do not retry uncertain Graph outcomes automatically: a timeout may
        // mean Meta accepted the send. Reconciliation is required.
        await outbox.updateOne({ _id: item._id, status: "executing" },
          { $set: { status: "needs_review", updatedAt: new Date() } });
      }
    }
    if (production && summary.blocked) {
      console.info("Production Instagram execution blocked", { blocked: summary.blocked, reasons: blockedReasons });
    }
    return summary;
  } finally { await client.close(); }
}
