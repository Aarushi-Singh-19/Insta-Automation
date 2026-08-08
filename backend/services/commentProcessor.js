const ProcessedEvent = require("../models/processedEvent.model");
const Rule = require("../models/Rule");

const { findMatchingRule } = require("../utils/ruleEngine");
const { findActiveCampaignByPost } = require("../utils/campaignResolver");

const actionBuilder = require("./actionBuilder.service");
const actionQueue = require("../queues/action.queue");

const InstagramAccount = require("../models/InstagramAccount");

const { processGate } = require("../services/gate.engine");

const FollowGateMessageService = require("./followGateMessage.service");
const processComment = async ({
  eventId,
  postId,
  commentText,
  username,
  recipientId,
  instagramAccountId,
}) => {
  // ===============================
  // DUPLICATE CHECK
  // ===============================
  const existing = await ProcessedEvent.findOne({
    eventId,
  });

  if (existing) {
    console.log("🚨 COMMENT PROCESSOR EXECUTED");
    console.log("Duplicate event ignored:", eventId);
    return;
  }

  await ProcessedEvent.create({
    eventId,
    type: "comment",
    status: "processed",
  });

  console.log("New event stored:", eventId);

  // ===============================
  // FIND CAMPAIGN
  // ===============================
  const campaign = await findActiveCampaignByPost(postId);

  if (!campaign) {
    console.log("NO ACTIVE CAMPAIGN FOR POST:", postId);
    return;
  }

  const instagramAccount = await InstagramAccount.findOne({
  userId: campaign.userId,
  status: "active",
});

if (!instagramAccount) {
  console.log(
    "NO ACTIVE INSTAGRAM ACCOUNT FOR CAMPAIGN USER:",
    campaign.userId
  );

  return;
}

console.log("INSTAGRAM ACCOUNT FOUND:", {
  accountId: instagramAccount._id,
  username: instagramAccount.username,
});

  console.log("CAMPAIGN FOUND:", {
    campaignId: campaign._id,
    userId: campaign.userId,
  });

  // ===============================
  // FIND ACTIVE RULES
  // ===============================
  const activeRules = await Rule.find({
    _id: {
      $in: campaign.ruleIds || [],
    },
    isActive: true,
  }).lean();

  if (!activeRules.length) {
    console.log(
      "NO ACTIVE RULES FOR CAMPAIGN:",
      campaign._id
    );
    return;
  }

  // ===============================
  // MATCH RULE
  // ===============================
  console.log("COMMENT:", JSON.stringify(commentText));

  console.log(
    "ACTIVE RULES:",
    JSON.stringify(activeRules, null, 2)
  );

  const matchedRule = findMatchingRule(
    commentText,
    activeRules
  );

  if (!matchedRule) {
    console.log(
      "NO RULE MATCHED FOR COMMENT:",
      commentText
    );
    return;
  }

  console.log("RULE MATCHED:", {
    ruleId: matchedRule._id,
  });

  // ===============================
  // BUILD ACTIONS
  // ===============================
  const actions = actionBuilder.buildActionsFromRule(
    matchedRule,
    username,
    recipientId,
    campaign
  );

  // ===============================
  // GATE ENGINE
  // ===============================
const gateResult = await processGate({
  campaign,
  rule: matchedRule,
comment: {
  eventId,
  postId,
  commentText,
  username,
  recipientId,
  instagramAccountId: instagramAccount._id,
},
  actions,
});

if (!gateResult.continueWorkflow) {
  console.log("Workflow paused by Gate Engine");

  if (gateResult.gate) {
    console.log(
      "📨 Sending Follow Gate message for session:",
      gateResult.gate._id
    );

    await FollowGateMessageService.send(
      gateResult.gate
    );

    console.log(
      "✅ Follow Gate message sent:",
      gateResult.gate._id
    );
  }

  return;
}

  console.log("QUEUE COMMENT ID:", eventId);

  console.log(
    "ACTIONS BUILT:",
    JSON.stringify(actions, null, 2)
  );

  // ===============================
  // QUEUE JOBS
  // ===============================
  for (const action of actions) {
    const executionPayload = {
      action,

      campaignId: campaign._id,

      commentId: eventId,

      ruleId: matchedRule._id,

      userId: campaign.userId,

      postId,

      username,

      recipientId,

      commentText,

      receivedAt: new Date(),
    };

    const job = await actionQueue.add(
      "process-comment",
      executionPayload,
      {
        attempts: 3,

        backoff: {
          type: "exponential",
          delay: 5000,
        },

        removeOnComplete: 1000,

        removeOnFail: 5000,
      }
    );

    console.log("JOB QUEUED:", {
      jobId: job.id,
      actionType: action.type,
      campaignId: campaign._id,
      ruleId: matchedRule._id,
    });
  }
};

module.exports = {
  processComment,
};