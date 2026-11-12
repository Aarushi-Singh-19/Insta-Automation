// Staging-only execution coordinator. Every external send is at-most-once:
// an uncertain network result remains "sending" for manual reconciliation,
// never retried blindly. Production callbacks are NOT routed here.
import { ObjectId } from "mongodb";
import { verifiedQuotaState } from "./quota-reconciliation.js";
import { verifiedFollowGateRelease } from "./follow-gate-release.js";
import { startFollowGate } from "./follow-gate-state.js";
import { buildFollowPrompt } from "./follow-gate-prompt.js";
import { validateStagingMongoConfig } from "./staging-mongodb.js";
import { authorizeCommentActions } from "./automation-authorization.js";
import { buildCommentActionSpec } from "./comment-action-spec.js";
import { replyToInstagramComment, sendInstagramDM, getInstagramFollowerStatus } from "./instagram-graph.js";

const objectId = value => /^[a-f\d]{24}$/i.test(String(value || "")) ? new ObjectId(String(value)) : null;
const numberId = value => /^\d+$/.test(String(value || ""));
function usagePeriod(user, now) {
  if (user.subscriptionStatus === "trial") {
    if (!user.trialStartDate || !user.trialEndDate) return null;
    return { period: "trial", key: "trial:" + String(user.trialStartDate), limit: 500 };
  }
  const start = user.subscriptionCurrentStart;
  const end = user.subscriptionCurrentEnd || user.planEndDate;
  if (!start || !end || new Date(start) > now || new Date(end) <= now) return null;
  return { period: "billing", key: "billing:" + new Date(start).toISOString(), limit: 10000 };
}
export async function executeStagingActions({ env, MongoClient, fetchImpl, getFollower = getInstagramFollowerStatus, limit = 5, now = new Date() }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (env?.ENABLE_STAGING_INSTAGRAM_SEND !== "true") throw new Error("STAGING_SEND_DISABLED");
  // Explicitly bind live staging sends to one operator-approved Instagram
  // account. An enabled flag alone must never send for every copied account.
  if (!/^\d+$/.test(String(env?.STAGING_SEND_INSTAGRAM_BUSINESS_ID || ""))) {
    throw new Error("STAGING_SEND_ACCOUNT_NOT_APPROVED");
  }
  if (typeof MongoClient !== "function" || typeof fetchImpl !== "function") throw new TypeError("DEPENDENCIES_REQUIRED");
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new RangeError("INVALID_LIMIT");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  const summary = { inspected: 0, completed: 0, blocked: 0, uncertain: 0 };
  try {
    await client.connect();
    const db = client.db(dbName);
    const outbox = db.collection("cloudflare_staging_action_outbox");
    const sends = db.collection("cloudflare_staging_action_sends");
    const quotas = db.collection("cloudflare_staging_dm_quotas");
    const cursor = outbox.find({ status: { $in: ["awaiting_authorization", "awaiting_follow"] }, authorized: false })
      .sort({ createdAt: 1, _id: 1 }).limit(limit);
    for await (const item of cursor) {
      summary.inspected++;
      const plan = item.plan;
      if (!plan || !numberId(plan.eventId) || !numberId(plan.postId) ||
          !objectId(plan.campaignId) || !objectId(plan.ruleId)) { summary.blocked++; continue; }
      const inbox = await db.collection("cloudflare_staging_webhook_inbox").findOne({ _id: item._id, status: "planned" });
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
      if (!account || !user || !account.accessToken || (campaign.settings?.enableDM !== false && !account.pageAccessToken)) { summary.blocked++; continue; }
      if (String(account.instagramBusinessId) !== String(env.STAGING_SEND_INSTAGRAM_BUSINESS_ID)) {
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
      if (!action.ready) { summary.blocked++; continue; }
      let followGateVerified = false;
      let followPrompt = null;
      if (action.spec.followGateRequired) {
        const session = await db.collection("cloudflare_staging_follow_gate_sessions").findOne({
          _id: "follow:" + String(item._id), status: "VERIFIED"
        });
        const release = verifiedFollowGateRelease({
          session, inboxId: item._id, campaignId: campaign._id, userId: user._id,
          recipientId: inbox.event.recipientId, commentId: plan.eventId
        });
        if (release.allowed) {
          followGateVerified = true;
        } else if (item.status === "awaiting_authorization" && !session) {
          if (!numberId(inbox.event.recipientId)) { summary.blocked++; continue; }
          // Never infer follower status from a button click or local data.
          // An unavailable Meta status blocks the send rather than bypassing the gate.
          let follows;
          try {
            const result = await getFollower({
              accessToken: account.accessToken, instagramScopedUserId: inbox.event.recipientId, fetchImpl
            });
            follows = result?.followsBusiness;
          } catch { summary.blocked++; continue; }
          if (follows === true) {
            followGateVerified = true;
          } else if (follows === false && account.username) {
            try {
              followPrompt = buildFollowPrompt({
                sessionId: "follow:" + String(item._id),
                profileUrl: "https://www.instagram.com/" + String(account.username) + "/"
              });
            } catch { summary.blocked++; continue; }
          } else { summary.blocked++; continue; }
        } else { summary.blocked++; continue; }
      }
      const period = usagePeriod(user, now);
      if (!period && action.spec.dm) { summary.blocked++; continue; }
      if (item.status === "awaiting_follow" && !followGateVerified) { summary.blocked++; continue; }
      const quotaId = period ? String(user._id) + ":" + period.key : null;
      const counter = quotaId ? await quotas.findOne({ _id: quotaId }) : null;
      const verified = action.spec.dm ? verifiedQuotaState(counter, period, user._id) : null;
      if (action.spec.dm && !verified) { summary.blocked++; continue; }
      const usage = { period: period?.period || "billing", sent: verified?.sent ?? 0 };
      // A prompt is allowed after subscription/quota checks, not gated content.
      const authorization = authorizeCommentActions({ user, campaign, rule, account, usage,
        followGateVerified: followGateVerified || Boolean(followPrompt), now });
      if (!authorization.authorized) { summary.blocked++; continue; }
      // Atomically claim this outbox row before any provider call. Two Worker
      // invocations must never concurrently send actions for the same comment.
      if (followPrompt) {
        await startFollowGate({ db, inboxId: String(item._id),
          campaignId: String(campaign._id), userId: String(user._id),
          recipientId: String(inbox.event.recipientId), commentId: String(plan.eventId) });
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
            baselineSource: "render-reconciliation", userId: user._id, period: period.period,
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
          const result = kind === "reply"
            ? await replyToInstagramComment({ accessToken: account.accessToken, commentId: plan.eventId,
                message: details.message, fetchImpl })
            : await sendInstagramDM({ accessToken: account.pageAccessToken, instagramBusinessId: account.instagramBusinessId,
                ...(kind === "gate_prompt" ? { commentId: plan.eventId } :
                  action.spec.followGateRequired ? { recipientId: inbox.event.recipientId } : { commentId: plan.eventId }),
                message: kind === "gate_prompt" ? details.text : details.message,
                buttons: details.buttons, fetchImpl });
          await sends.updateOne({ _id: sendId, status: "sending" },
            { $set: { status: "sent", providerId: result.id || result.messageId, completedAt: new Date() } });
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
        await outbox.updateOne({ _id: item._id, status: "executing" },
          { $set: followPrompt
            ? { status: "awaiting_follow", dispatched: false, gatePromptSentAt: new Date() }
            : { status: "completed", dispatched: true, completedAt: new Date() } });
        summary.completed++;
      } else {
        // Do not retry uncertain Graph outcomes automatically: a timeout may
        // mean Meta accepted the send. Reconciliation is required.
        await outbox.updateOne({ _id: item._id, status: "executing" },
          { $set: { status: "needs_review", updatedAt: new Date() } });
      }
    }
    return summary;
  } finally { await client.close(); }
}
