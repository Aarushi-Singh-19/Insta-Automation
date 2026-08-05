const ProcessedEvent = require("../models/processedEvent.model");
const Rule = require("../models/Rule");

const { findMatchingRule } = require("../utils/ruleEngine");
const { findActiveCampaignByPost } = require("../utils/campaignResolver");

const actionBuilder = require("./actionBuilder.service");
const actionQueue = require("../queues/action.queue");

const processComment = async ({
  eventId,
  postId,
  commentText,
  username,
  recipientId,
}) => {
  // ===============================
  // DUPLICATE CHECK
  // ===============================
  const existing = await ProcessedEvent.findOne({
    eventId,
  });

  if (existing) {
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
    console.log("NO ACTIVE RULES FOR CAMPAIGN:", campaign._id);
    return;
  }

  // ===============================
  // MATCH RULE
  // ===============================
  const matchedRule = findMatchingRule(
    commentText,
    activeRules
  );

  if (!matchedRule) {
    console.log("NO RULE MATCHED FOR COMMENT:", commentText);
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

  if (!actions.length) {
    console.log("NO ACTIONS BUILT FOR RULE:", matchedRule._id);
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