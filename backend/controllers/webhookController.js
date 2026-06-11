const ProcessedEvent = require("../models/processedEvent.model");
const LogService = require("../services/log.service");

const { findMatchingRule } = require("../utils/ruleEngine");
const { findActiveCampaignByPost } = require("../utils/campaignResolver");
const { buildActionFromRule } = require("../services/actionBuilder.service");

const actionQueue = require("../queues/action.queue");


// ===============================
// WEBHOOK VERIFY (UNCHANGED)
// ===============================
const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("Webhook Verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};


// ===============================
// MAIN WEBHOOK HANDLER (FIXED SAFE VERSION)
// ===============================
const receiveWebhook = async (req, res) => {
  try {
    console.log("=== WEBHOOK HIT ===");

    const entries = req.body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const changeObj of changes) {
        const change = changeObj.value;

        const postId =
          change?.media_id ||
          change?.post_id ||
          change?.media?.id;

        const commentText = change?.text || "";
        const username = change?.from?.username || "unknown";
        const eventId = change?.id;

        console.log("DATA:", {
          postId,
          commentText,
          username,
          eventId,
        });

        // ===============================
        // VALIDATION
        // ===============================
        if (!eventId || !postId) continue;

        // ===============================
        // 1. SAFE DEDUPLICATION (ATOMIC)
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
          { upsert: true, new: true }
        );

        if (!inserted?.isNew && inserted?.createdAt === undefined) {
          console.log("🔁 Duplicate event ignored:", eventId);
          continue;
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

          continue;
        }

        if (!campaign.userId) {
          await LogService.log({
            campaignId: campaign._id,
            userId: null,
            type: "INVALID_CAMPAIGN",
            message: "Campaign missing userId",
            metadata: { postId },
          });

          continue;
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

        const matchedRule = findMatchingRule(commentText, rules);

        if (!matchedRule) {
          await LogService.log({
            campaignId: campaign._id,
            userId: campaign.userId,
            type: "RULE_NOT_MATCHED",
            message: "No rule matched",
            metadata: { text: commentText },
          });

          continue;
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
      }
    }

    return res.json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Webhook error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ===============================
// OPTIONAL SIMPLE HANDLER (kept for debugging)
// ===============================
const handleWebhook = async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== "instagram") {
      return res.sendStatus(404);
    }

    console.log("Webhook Event:", JSON.stringify(body, null, 2));

    return res.sendStatus(200);
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
};

module.exports = {
  verifyWebhook,
  handleWebhook,
  receiveWebhook,
};