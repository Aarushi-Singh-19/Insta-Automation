const ProcessedEvent = require("../models/processedEvent.model");
// const LogService = require("../services/log.service");
const Rule = require('../models/Rule');

const { findMatchingRule } = require("../utils/ruleEngine");
// const { findActiveCampaignByPost } = require("../utils/campaignResolver");
const actionBuilder =
  require("../services/actionBuilder.service");

const actionQueue = require("../queues/action.queue");


const {
  findActiveCampaignByPost,
} = require("../utils/campaignResolver");
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
        const postId = change?.media?.id;
        console.log(
  "WEBHOOK MEDIA ID:",
  postId
);
        const commentText = change?.text || "";
        const username =
          change?.from?.username || "unknown";

        console.log("COMMENT EVENT:", {
          eventId,
          postId,
          commentText,
          username,
        });

        if (!eventId) {
          continue;
        }

  const existing =
  await ProcessedEvent.findOne({
    eventId,
  });

if (existing) {
  console.log(
    "Duplicate event ignored:",
    eventId
  );

  continue;
}

await ProcessedEvent.create({
  eventId,
  type: "comment",
  status: "processed",
});

      console.log(
          "New event stored:",
          eventId
        );

        const campaign =
          await findActiveCampaignByPost(
            postId
          );

        if (!campaign) {
          console.log(
            "NO ACTIVE CAMPAIGN FOR POST:",
            postId
          );

          continue;
        }

        console.log(
          "CAMPAIGN FOUND:",
          {
            campaignId: campaign._id,
            userId: campaign.userId,
          }
        );
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

  continue;
}

const matchedRule = findMatchingRule(
  commentText,
  activeRules
);
if (!matchedRule) {
  console.log(
    "NO RULE MATCHED FOR COMMENT:",
    commentText
  );

  continue;
}

console.log("RULE MATCHED:", {
  ruleId: matchedRule._id,
});

const action = actionBuilder.buildActionFromRule(
  matchedRule,
  username,
  campaign
);

const executionPayload = {
  action,

  campaignId: campaign._id,

  commentId: eventId,

  ruleId: matchedRule._id,

  userId: campaign.userId,

  postId,

  username,

  commentText,

  receivedAt: new Date(),
};
console.log("QUEUE COMMENT ID:", eventId);
console.log(
  "RAW WEBHOOK:",
  JSON.stringify(req.body, null, 2)
);

console.log(
  "ACTION BUILT:",
  JSON.stringify(action, null, 2)
);


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
  campaignId: campaign._id,
  ruleId: matchedRule._id,
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