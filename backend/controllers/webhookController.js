const ProcessedEvent = require("../models/processedEvent.model");
const LogService = require("../services/log.service");

const { findMatchingRule } = require("../utils/ruleEngine");
const { findActiveCampaignByPost } = require("../utils/campaignResolver");
const { buildActionFromRule } = require("../services/actionBuilder.service");

const actionQueue = require("../queues/action.queue");

const receiveWebhook = async (req, res) => {
  try {
    console.log("=== WEBHOOK HIT ===");

    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;

    const postId =
      change?.media_id ||
      change?.post_id ||
      change?.media?.id;

      console.log("POST_ID:", postId);

    const commentText = change?.text || "";
    const username = change?.from?.username || "unknown";
    const eventId = change?.id;

    console.log("DATA:", { postId, commentText, username, eventId });

    // ===============================
    // VALIDATION
    // ===============================
    if (!eventId || !postId) {
      return res.status(400).json({
        message: "Missing eventId or postId",
      });
    }

    // ===============================
    // 1. DEDUPLICATION
    // ===============================
    const existing = await ProcessedEvent.findOne({ eventId });

    if (existing) {
      console.log("🔁 Duplicate event ignored:", eventId);
      return res
        .status(200)
        .json({ message: "Duplicate event ignored" });
    }

    await ProcessedEvent.create({
      eventId,
      type: "comment",
      status: "processed",
    });

    // ===============================
    // 2. FIND CAMPAIGN (GLOBAL LOOKUP)
    // ===============================
    console.log("========== WEBHOOK DEBUG ==========");
console.log("Full Body:", JSON.stringify(req.body, null, 2));
console.log("Extracted postId:", postId);
console.log("Type:", typeof postId);
console.log("==================================");

    const campaign = await findActiveCampaignByPost(postId);

    if (!campaign) {
      await LogService.log({
        campaignId: null,
        userId: null,
        type: "NO_CAMPAIGN",
        message: "No active campaign found",
        metadata: { postId },
      });

      return res.json({ message: "No active campaign" });
    }

    if (!campaign.userId) {
      await LogService.log({
        campaignId: campaign._id,
        userId: null,
        type: "INVALID_CAMPAIGN",
        message: "Campaign missing userId",
        metadata: { postId },
      });

      return res.status(400).json({
        message: "Invalid campaign",
      });
    }

    // ===============================
    // 3. LOG INGESTION
    // ===============================
    await LogService.log({
      campaignId: campaign._id,
      userId: campaign.userId,
      type: "WEBHOOK_RECEIVED",
      message: "Webhook received",
      metadata: {
        postId,
        commentText,
        username,
        eventId,
      },
    });

    // ===============================
    // 4. RULE MATCHING
    // ===============================
    const rules = campaign.ruleIds || [];

    console.log("RAW RULES:", rules);
    console.log("COMMENT TEXT:", commentText);

    const matchedRule = findMatchingRule(commentText, rules);

    console.log("MATCH RESULT:", matchedRule);

    if (!matchedRule) {
      await LogService.log({
        campaignId: campaign._id,
        userId: campaign.userId,
        type: "RULE_NOT_MATCHED",
        message: "No rule matched",
        metadata: { text: commentText },
      });

      return res.json({ message: "No rule matched" });
    }

    await LogService.log({
      campaignId: campaign._id,
      userId: campaign.userId,
      type: "RULE_MATCHED",
      message: "Rule matched successfully",
      metadata: {
        ruleId: matchedRule.ruleId,
      },
    });

    // ===============================
    // 5. BUILD ACTION
    // ===============================
    const action = buildActionFromRule(
      matchedRule,
      username,
      campaign
    );

    // ===============================
    // 6. QUEUE ACTION
    // ===============================
    await actionQueue.add(
      "execute-action",
      {
        action,
        campaignId: campaign._id,
        ruleId: matchedRule._id,
        userId: campaign.userId,
        commentId: eventId,
      },
      {
        jobId: eventId,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      }
    );

    console.log("✅ JOB ADDED TO QUEUE");

    // ===============================
    // 7. LOG QUEUED ACTION
    // ===============================
    await LogService.log({
      campaignId: campaign._id,
      userId: campaign.userId,
      type: "ACTION_QUEUED",
      message: "Action queued successfully",
      metadata: action,
    });

    return res.json({
      success: true,
      message: "Webhook processed successfully",
      matchedRule,
    });
  } catch (error) {
    console.error("Webhook error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { receiveWebhook };