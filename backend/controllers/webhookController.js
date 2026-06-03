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

    const postId = change?.media_id || change?.post_id;
    const commentText = change?.text || "";
    const username = change?.from?.username || "unknown";
    const eventId = change?.id;

    console.log("DATA:", { postId, commentText, username, eventId });

    // ❌ Guard: invalid webhook
    if (!eventId || !postId) {
      return res.status(400).json({ message: "Missing eventId or postId" });
    }

    // ===============================
    // 1. DEDUPLICATION (CRITICAL)
    // ===============================
    const inserted = await ProcessedEvent.findOneAndUpdate(
      { eventId },
      {
        $setOnInsert: {
          eventId,
          type: "comment",
          status: "processed",
        },
      },
      {
        upsert: true,
        new: true,
        rawResult: true,
      }
    );

    // If document already existed → skip processing
    if (!inserted?.lastErrorObject?.upserted) {
      console.log("🔁 Duplicate event ignored:", eventId);
      return res.status(200).json({ message: "Duplicate event ignored" });
    }

    // ===============================
    // 2. FIND CAMPAIGN
    // ===============================
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

    // ===============================
    // 3. LOG INGESTION (SAFE)
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
    const matchedRule = findMatchingRule(commentText, rules);

    console.log("RULE COUNT:", rules.length);
    console.log("MATCHED RULE:", matchedRule);

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
        ruleId: matchedRule._id,
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
    // 6. ENQUEUE JOB (SAFE + DEDUP READY)
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
        jobId: eventId, // 🔥 CRITICAL: prevents retry duplication
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

    // ❌ IMPORTANT:
    // DO NOT update metrics here anymore
    // Metrics must be handled in WORKER only

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