import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

const oid = id => new ObjectId(id);
const asText = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
const validUrl = value => { try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol); } catch { return false; } };

export async function stagingAutomations({ env, MongoClient, authenticatedUserId, method, input }) {
  if (typeof authenticatedUserId !== "string" || !/^[a-f0-9]{24}$/i.test(authenticatedUserId)) throw new TypeError("AUTHENTICATED_USER_REQUIRED");
  const { uri, dbName } = validateStagingMongoConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const userId = oid(authenticatedUserId);
    if (method === "GET") {
      const docs = await db.collection("automations").find({ user: userId }).sort({ createdAt: -1 }).limit(100).toArray();
      return { status: 200, body: docs };
    }
    if (method !== "POST") return { status: 405, body: { success: false, message: "Method not allowed" } };
    if (!input || typeof input !== "object" || Array.isArray(input)) return { status: 400, body: { success: false, message: "Invalid automation" } };
    const triggerType = input.triggerType;
    const commentTriggerType = input.commentTriggerType;
    const mediaId = asText(input.instagramMediaId, 100);
    const dmMessage = asText(input.dmMessage, 2000);
    const keywords = Array.isArray(input.keywords) ? input.keywords.map(k => asText(k, 100)).filter(Boolean).slice(0, 20) : [];
    const commentReplyEnabled = input.commentReplyEnabled === true;
    const commentReplyMessage = asText(input.commentReplyMessage, 1000);
    const followGate = input.followGate === true;
    const mediaUrl = asText(input.instagramMediaUrl, 2048);
    const followGateMessage = asText(input.followGateMessage, 640) || "Please follow our profile to unlock your DM!";
    const dmButtons = Array.isArray(input.dmButtons) ? input.dmButtons.slice(0, 3).map(b => ({
      title: asText(b?.title, 20), url: asText(b?.url, 2048)
    })) : [];
    if (!["any-post", "specific-post", "next-post"].includes(triggerType) ||
        !["keyword", "any_comment"].includes(commentTriggerType) ||
        !dmMessage || (triggerType === "specific-post" && !/^\d{5,40}$/.test(mediaId)) ||
        (commentTriggerType === "keyword" && keywords.length === 0) ||
        (commentReplyEnabled && !commentReplyMessage) ||
        (mediaUrl && !validUrl(mediaUrl)) ||
        dmButtons.some(b => !b.title || !validUrl(b.url))) {
      return { status: 400, body: { success: false, message: "Invalid automation fields" } };
    }
    const user = await db.collection("users").findOne({ _id: userId }, { projection: { subscriptionStatus: 1, planEndDate: 1, trialEndDate: 1 } });
    const now = new Date();
    if (!user || !["active", "trial"].includes(user.subscriptionStatus) ||
        (user.subscriptionStatus === "active" && user.planEndDate && new Date(user.planEndDate) <= now) ||
        (user.subscriptionStatus === "trial" && user.trialEndDate && new Date(user.trialEndDate) <= now)) {
      return { status: 403, body: { success: false, message: "Subscription required" } };
    }
    const account = await db.collection("instagramaccounts").findOne({ userId, status: "active" }, { projection: { _id: 1 } });
    if (!account) return { status: 400, body: { success: false, message: "Connect an Instagram account first" } };
    const automationId = new ObjectId(), ruleId = new ObjectId(), campaignId = new ObjectId();
    const automation = {
      _id: automationId, user: userId, triggerType, instagramMediaId: mediaId,
      instagramMediaUrl: mediaUrl, commentTriggerType, keywords, dmMessage, dmButtons,
      commentReplyEnabled, commentReplyMessage, followGate, followGateMessage,
      matchType: "any", status: "active", createdAt: now, updatedAt: now
    };
    const rule = {
      _id: ruleId, userId, ruleName: "Automation - " + automationId,
      postId: triggerType === "specific-post" ? mediaId : "",
      triggerType: commentTriggerType, triggerKeywords: commentTriggerType === "keyword" ? keywords : [],
      replyMode: "single", replies: commentReplyEnabled ? [commentReplyMessage] : [],
      isActive: true, createdAt: now, updatedAt: now
    };
    const campaign = {
      _id: campaignId, userId, automationId, name: "Automation - " + automationId,
      triggerType, instagramMediaId: mediaId, instagramMediaUrl: mediaUrl, instagramAccountId: "",
      postIds: triggerType === "specific-post" ? [mediaId] : [],
      status: "active", ruleIds: [ruleId],
      settings: { enableDM: true, enableReply: commentReplyEnabled, dmMessage, dmButtons, minDelaySeconds: 10, maxDelaySeconds: 40 },
      gate: { gateType: followGate ? "FOLLOW" : "NONE", status: followGate ? "enabled" : "disabled",
        openingMessage: followGate ? followGateMessage : "", buttonText: "I'm Following" },
      metrics: { commentsProcessed: 0, repliesSent: 0, dmsSent: 0, errors: 0 },
      createdAt: now, updatedAt: now
    };
    // All three collections must commit together; a failed write must not leave an orphan campaign.
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection("automations").insertOne(automation, { session });
        await db.collection("rules").insertOne(rule, { session });
        await db.collection("campaigns").insertOne(campaign, { session });
      });
    } finally { await session.endSession(); }
    return { status: 201, body: { success: true, automation, rule, campaign } };
  } finally { await client.close(); }
}
