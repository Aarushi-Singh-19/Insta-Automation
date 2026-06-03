const LogService = require("../services/log.service");
const { findMatchingRule } = require("../utils/ruleEngine");
const { findActiveCampaignByPost } = require("../utils/campaignResolver");
const { buildActionFromRule } = require("../services/actionBuilder.service");

const receiveWebhook = async (req, res) => {
  try {

    console.log("=== WEBHOOK HIT ===");


    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;

    const postId = change?.media_id || change?.post_id;
    const commentText = change?.text || "";
    const username = change?.from?.username || "unknown";

    console.log("DATA:", { postId, commentText, username });

    const campaign = await findActiveCampaignByPost(postId);

    if (!campaign) {
      return res.json({ message: "No active campaign" });
    }

    const rules = campaign.ruleIds || [];

    const matchedRule = findMatchingRule(commentText, rules);

    
    console.log("RULE COUNT:", rules.length);
console.log("MATCHED RULE:", matchedRule);

    await LogService.log({
      campaignId: campaign._id,
      userId: campaign.userId,
      type: "WEBHOOK_RECEIVED",
      message: "Webhook received",
      metadata: {
        postId,
        commentText,
        username,
      },
    });

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

const action = buildActionFromRule(
  matchedRule,
  username,
  campaign
);

const actionQueue = require("../queues/action.queue");

await actionQueue.add("execute-action", {
  action,
  campaignId: campaign._id,
  ruleId: matchedRule._id,
  userId: campaign.userId,
  commentId: change?.id,
});

console.log("✅ JOB ADDED TO QUEUE");

await LogService.log({
  campaignId: campaign._id,
  userId: campaign.userId,
  type: "ACTION_QUEUED",
  message: "Action queued successfully",
  metadata: action,
});

    

    return res.json({
      success: true,
      message: "Rules working correctly",
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