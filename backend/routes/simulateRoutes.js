const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const Rule = require("../models/Rule");
const Campaign = require("../models/campaign.model");

const actionBuilder = require("../services/actionBuilder.service");
const actionQueue = require("../queues/action.queue");

// Simulate Instagram comment event
router.post("/comment", auth, async (req, res) => {
  try {
    const { commentText } = req.body;

    if (!commentText) {
      return res.status(400).json({ message: "commentText required" });
    }

    // Get user rules only
console.log("REQ USER:", req.user);

const rules = await Rule.find({
  isActive: true,
});

console.log(
  "ALL RULES:",
  JSON.stringify(rules, null, 2)
);
console.log(rules);

    let matchedRule = null;

    for (let rule of rules) {
      if (rule.triggerType === "any_comment") {
        matchedRule = rule;
        break;
      }

      const keywords = rule.triggerKeywords || [];

      if (
        keywords.some((keyword) =>
          commentText.toLowerCase().includes(keyword.toLowerCase())
        )
      ) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule) {
      return res.json({
        success: true,
        message: "No rule matched",
      });
    }

    // Pick reply


const fakeCampaign = await Campaign.findOne({});

console.log("FOUND CAMPAIGN:", fakeCampaign);

if (!fakeCampaign) {
  return res.status(400).json({
    message: "Create a campaign first",
  });
}

console.log(
  "SIMULATION USING CAMPAIGN:",
  fakeCampaign._id
);

const action =
  actionBuilder.buildActionFromRule(
    matchedRule,
    "simulation_user",
    fakeCampaign
  );;

const job = await actionQueue.add(
  
  "simulation-comment",
  {
    action,

    campaignId: fakeCampaign._id,

    commentId:
      "simulation-comment-" + Date.now(),

    ruleId: matchedRule._id,

    userId: req.user.id,

    username: "simulation_user",

    commentText,

    receivedAt: new Date(),
  }
);

console.log(
  "JOB ADDED STATE:",
  await job.getState()
);

console.log(
  "JOB ID:",
  job.id
);
res.json({
  success: true,
  matchedRule: matchedRule.ruleName,
  action,
  jobId: job.id,
});

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;