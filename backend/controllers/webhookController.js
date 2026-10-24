const ProcessedEvent = require("../models/processedEvent.model");
const commentProcessor = require("../services/commentProcessor.js");

const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("Instagram webhook verification succeeded");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

const receiveWebhook = async (req, res) => {
  try {
    const body = req.body;

    if (body?.object !== "instagram") {
      return res.sendStatus(404);
    }

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];

      for (const changeObj of changes) {
        if (changeObj.field !== "comments") {
          continue;
        }

        const change = changeObj.value || {};
        const eventId = change.id || change.comment_id;
        const postId = change.media?.id || change.media_id || change.media?.id;
        const commentText = change.text || "";
        const username = change.from?.username || "unknown";
        const recipientId = change.from?.id || null;
        const commentTimestamp = change.timestamp || change.created_time || null;

        if (!eventId || !postId) {
          console.warn("Ignoring incomplete Instagram comment webhook", {
            hasEventId: Boolean(eventId),
            hasPostId: Boolean(postId),
            field: changeObj.field,
          });
          continue;
        }

        // Webhooks can be retried by Meta. Let the shared processor perform
        // the authoritative duplicate check and mark the event consistently
        // with polling. The processor itself owns ProcessedEvent insertion.
        await commentProcessor.processComment({
          eventId: String(eventId),
          postId: String(postId),
          commentText,
          username,
          recipientId: recipientId ? String(recipientId) : null,
          commentTimestamp,
        });
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error(
      "Instagram webhook processing failed:",
      error.response?.data || error.message
    );
    return res.sendStatus(500);
  }
};

const handleWebhook = async (req, res) => {
  if (req.body?.object !== "instagram") {
    return res.sendStatus(404);
  }
  return res.sendStatus(200);
};

module.exports = {
  verifyWebhook,
  handleWebhook,
  receiveWebhook,
};
