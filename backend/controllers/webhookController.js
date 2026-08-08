const ProcessedEvent = require("../models/processedEvent.model");
// const LogService = require("../services/log.service");
const Rule = require('../models/Rule');

const InstagramAccount = require("../models/InstagramAccount");

const commentProcessor = require("../services/commentProcessor.js");


const { findMatchingRule } = require("../utils/ruleEngine");
const { findActiveCampaignByPost } = require("../utils/campaignResolver");
const actionBuilder =
  require("../services/actionBuilder.service");

const actionQueue = require("../queues/action.queue");

const AutomationExecutionService = require("../services/automationExecution.service");


const {
    findMatchingAutomations,
} = require("../utils/automationResolver");
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
    console.log("========================================");
    console.log("📩 WEBHOOK RECEIVED");
    console.log("========================================");

    console.log(
      "WEBHOOK BODY:",
      JSON.stringify(req.body, null, 2)
    );

    const body = req.body;

    // ==========================================
    // INSTAGRAM MESSAGING / POSTBACK DEBUG
    // ==========================================

    if (body.object === "instagram") {
      const messagingEntries = body.entry || [];

      for (const entry of messagingEntries) {
        if (entry.messaging) {
          console.log("📨 MESSAGING EVENT DETECTED");

          for (const messagingEvent of entry.messaging) {
            console.log(
              "MESSAGING EVENT:",
              JSON.stringify(
                messagingEvent,
                null,
                2
              )
            );

            if (messagingEvent.postback) {
              console.log("🔘 POSTBACK RECEIVED");

              console.log(
                "POSTBACK:",
                JSON.stringify(
                  messagingEvent.postback,
                  null,
                  2
                )
              );
            }
          }
        }
      }
    }

    // ==========================================
    // EXISTING COMMENT WEBHOOK LOGIC
    // ==========================================

    const entries = req.body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const changeObj of changes) {
        console.log(
          "WEBHOOK FIELD:",
          changeObj.field
        );

        if (changeObj.field !== "comments") {
          continue;
        }

        const change = changeObj.value;

        const eventId = change?.id;

        const postId =
          change?.media?.id ||
          change?.media_id ||
          null;

        const commentText =
          change?.text || "";

        const username =
          change?.from?.username ||
          "unknown";

        const recipientId =
          change?.from?.id ||
          null;

        console.log("COMMENT EVENT:", {
          eventId,
          postId,
          commentText,
          username,
          recipientId,
        });

        if (!eventId) {
          continue;
        }

        await commentProcessor.processComment({
          eventId,
          postId,
          commentText,
          username,
          recipientId,
        });
      }
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error(
      "Webhook error:",
      error
    );

    return res.sendStatus(500);
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
