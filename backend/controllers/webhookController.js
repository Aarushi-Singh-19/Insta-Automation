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
// Opt-in exclusive staging ownership. Off by default and never silently
// duplicates a production event. Meta's original signed bytes are forwarded.
const crypto = require("node:crypto");
async function relayStagingWebhook(req) {
  const accountId = String(process.env.CLOUDFLARE_STAGING_RELAY_ACCOUNT_ID || "");
  if (process.env.ENABLE_CLOUDFLARE_STAGING_EXCLUSIVE_RELAY !== "true") return null;
  if (!/^\d+$/.test(accountId) || !process.env.CLOUDFLARE_STAGING_RELAY_TOKEN ||
      !process.env.META_APP_SECRET) throw new Error("STAGING_RELAY_CONFIG_REQUIRED");
  // Meta webhook entry.id is the Instagram webhook owner ID, which can differ
  // from the account identifier used by other Instagram API endpoints.
  // Never require a staging signature for events belonging to other accounts.
  const webhookEntryId = String(process.env.CLOUDFLARE_STAGING_RELAY_WEBHOOK_ENTRY_ID || accountId);
  if (!/^\d+$/.test(webhookEntryId)) throw new Error("STAGING_RELAY_WEBHOOK_ID_REQUIRED");
  const hasStagingEvent = (req.body?.entry || []).some(entry => String(entry.id) === webhookEntryId);
  if (!hasStagingEvent) return null;
  const raw = req.instagramWebhookRawBody;
  const supplied = req.get("x-hub-signature-256") || "";
  const expected = "sha256=" + crypto.createHmac("sha256", process.env.META_APP_SECRET).update(raw || "").digest("hex");
  if (!raw || supplied.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    // Diagnostic metadata only; never log raw payload, signature or app secret.
    console.error("STAGING_RELAY_SIGNATURE_REJECTED", {
      rawBodyPresent: Buffer.isBuffer(raw),
      signatureHeaderPresent: Boolean(supplied),
      signatureFormatValid: /^sha256=[a-f0-9]{64}$/i.test(supplied)
    });
    const error = new Error("INVALID_META_SIGNATURE");
    error.status = 403;
    throw error;
  }
  const destination = "https://triggerdm-backend-staging.aarushisingh19102005-ecc.workers.dev/__cloudflare/staging-ingest";
  const response = await fetch(destination, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": supplied,
      "authorization": "Bearer " + process.env.CLOUDFLARE_STAGING_RELAY_TOKEN
    },
    body: raw,
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error("STAGING_RELAY_UNAVAILABLE");
  return webhookEntryId;
}

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
    // Cloudflare owns only the explicitly selected staging account once its
    // durable inbox acknowledges the event. All other accounts stay on Render.
    const stagingOwner = await relayStagingWebhook(req);

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
      if (stagingOwner && String(entry.id) === stagingOwner) continue;
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

        // Only top-level comments may trigger an automation. Replies to comments
        // (including replies posted by TriggerDM) must never start another run.
        if (change?.parent_id) {
          console.log("Skipping comment reply to prevent automation loops:", change?.id);
          continue;
        }

        // Instagram can send a webhook for a public reply created by our own
        // business account. Ignore it before it reaches the automation engine.
        const webhookOwnerId = String(entry.id || "");
        const commentAuthorId = String(change?.from?.id || "");
        if (
          webhookOwnerId &&
          commentAuthorId &&
          webhookOwnerId === commentAuthorId
        ) {
          console.log("Skipping own-account comment webhook:", change?.id);
          continue;
        }

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

    return res.sendStatus(error.status || 503);
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
