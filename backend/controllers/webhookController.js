const commentProcessor = require("../services/commentProcessor.js");
const GateSession = require("../models/GateSession");
const InstagramAccount = require("../models/InstagramAccount");
const FollowVerificationService = require("../services/followVerification.service");
const ResumeWorkflowService = require("../services/resumeWorkflow.service");
const instagramApiService = require("../services/instagramApiService");

const FOLLOW_GATE_PREFIX = "FOLLOW_GATE_VERIFY:";

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

async function handleFollowGatePostback(payload) {
  const token = payload.slice(FOLLOW_GATE_PREFIX.length);
  if (!token) {
    console.warn("Ignoring follow-gate postback with no token");
    return;
  }

  try {
    const result = await FollowVerificationService.verify(token);

    if (result.verified) {
      await ResumeWorkflowService.resume(token);
      console.log("Follow verified from Instagram postback; original actions queued");
      return;
    }

    // Keep the user in Instagram: explain that the follow was not confirmed
    // and allow them to tap the same postback button again after following.
    const session = result.session;
    const account = await InstagramAccount.findById(session.instagramAccountId);
    if (!account || account.status !== "active") {
      throw new Error("NO_ACTIVE_INSTAGRAM_ACCOUNT");
    }

    await instagramApiService.sendDM({
      accessToken: account.pageAccessToken || account.accessToken,
      instagramBusinessId: account.instagramBusinessId,
      recipientId: session.recipientId,
      message: "I couldn't confirm that you're following yet. Follow the account, then tap “I've Followed” again.",
    });
    console.log("Follow-gate postback received; follow not yet confirmed");
  } catch (error) {
    // A repeated tap after the first successful verification should be safe.
    if (error.message === "SESSION_NOT_WAITING") {
      const session = await GateSession.findOne({ verificationToken: token });
      if (session && session.status === "COMPLETED") {
        console.log("Duplicate follow-gate postback acknowledged", session._id.toString());
        return;
      }
    }

    console.error(
      "Follow-gate postback processing failed:",
      error.response?.data || error.message
    );
    throw error;
  }
}

const receiveWebhook = async (req, res) => {
  // Staging diagnostics: log receipt and event shape without logging tokens or full user payloads.
  console.log("📩 Instagram webhook POST received", {
    path: req.originalUrl,
    object: req.body?.object,
    entryCount: Array.isArray(req.body?.entry) ? req.body.entry.length : 0,
    fields: Array.isArray(req.body?.entry)
      ? [...new Set(req.body.entry.flatMap((entry) => (Array.isArray(entry.changes) ? entry.changes.map((change) => change.field) : [])))]
      : [],
    hasMessagingEvents: Array.isArray(req.body?.entry) && req.body.entry.some((entry) => Array.isArray(entry.messaging) && entry.messaging.length > 0),
  });
  try {
    const body = req.body;

    if (body?.object !== "instagram") {
      return res.sendStatus(404);
    }

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      // Instagram messaging postbacks are how the “I've Followed” button
      // resumes the original comment workflow without opening a web page.
      const messagingEvents = Array.isArray(entry.messaging) ? entry.messaging : [];
      for (const event of messagingEvents) {
        const payload = event.postback?.payload;
        if (typeof payload === "string" && payload.startsWith(FOLLOW_GATE_PREFIX)) {
          await handleFollowGatePostback(payload);
        }
      }

      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const changeObj of changes) {
        if (changeObj.field !== "comments") {
          continue;
        }

        const change = changeObj.value || {};
        const eventId = change.id || change.comment_id;
        const postId = change.media?.id || change.media_id || null;
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

        // The shared processor checks ProcessedEvent so the same comment
        // received again (including by Meta retry) is not intentionally rerun.
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
