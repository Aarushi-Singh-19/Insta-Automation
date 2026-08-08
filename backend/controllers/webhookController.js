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
    console.log(
      "WEBHOOK RECEIVED:",
      JSON.stringify(req.body, null, 2)
    );

    const entries = req.body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      const instagramAccount = await InstagramAccount.findOne({
  instagramBusinessId: entry.id,
  status: "active",
});

if (!instagramAccount) {
  console.error(
    "No active Instagram account found for webhook entry:",
    entry.id
  );
  continue;
}

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

        console.log(
          "WEBHOOK MEDIA ID:",
          postId
        );

        const commentText = change?.text || "";

        const username =
          change?.from?.username || "unknown";

        const recipientId =
          change?.from?.id || null;

        console.log("COMMENT EVENT:", {
          eventId,
          postId,
          commentText,
          username,
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
  instagramAccountId: instagramAccount._id,
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
