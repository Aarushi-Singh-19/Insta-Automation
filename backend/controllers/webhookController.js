const { findActiveCampaignByPost } = require("../utils/campaignResolver");
const ActionService = require("../services/action.service");
const { buildActionFromRule } = require("../services/actionBuilder.service");
const { findMatchingRule } = require("../utils/ruleEngine");

// VERIFY WEBHOOK
const verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

// RECEIVE WEBHOOK
const receiveWebhook = async (req, res) => {
  try {
    console.log("=== WEBHOOK HIT ===");
    console.log("STEP 1 HIT");

    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;

    console.log("STEP 2 HIT");

    const postId = change?.media_id || change?.post_id;
    const commentText = change?.text || "";
    const username = change?.from?.username || "unknown";

    console.log("STEP 3 HIT", postId, commentText, username);

    if (!postId) {
      return res.json({ message: "No postId found" });
    }

    const campaign = await findActiveCampaignByPost(postId);
    console.log("CAMPAIGN FOUND:", campaign ? "YES" : "NO");

    if (!campaign) {
      return res.json({ message: "No active campaign" });
    }

    const rules = campaign.ruleIds || [];

    console.log("RULE COUNT:", rules.length);

   const matchedRule = findMatchingRule(commentText, rules);

if (!matchedRule) {
  return res.json({ message: "No rule matched" });
}
const action = buildActionFromRule(matchedRule, username);

const actionQueue = require("../queues/action.queue");

await actionQueue.add("execute-action", {
  action,
  campaign,
  commentId: change?.id, // IMPORTANT
});

    return res.json({
      success: true,
      message: "Action executed",
      campaign: campaign.name,
      matchedRule,
      action,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  verifyWebhook,
  receiveWebhook,
};