const Automation = require("../models/Automation");
const Campaign = require("../models/campaign.model");
const Rule = require("../models/Rule");

const createAutomation = async (req, res) => {
  try {
    const {
      triggerType,
      instagramMediaId,
      keywords,
      matchType,
      dmMessage,
      commentReplyEnabled,
      commentReplyMessage,
      followGate,
    } = req.body;

    // =========================
    // 1. Save Automation
    // =========================
    const automation = await Automation.create({
      user: req.user.id,
      triggerType,
      instagramMediaId,
      keywords,
      matchType,
      dmMessage,
      commentReplyEnabled,
      commentReplyMessage,
      followGate,
    });

    console.log("✅ Automation Saved:", automation._id);

    // =========================
    // 2. Create Rule
    // =========================
    const rule = await Rule.create({
      userId: req.user.id,

      ruleName: `Automation - ${automation._id}`,

      postId:
        triggerType === "specific-post"
          ? instagramMediaId
          : "",

      triggerType:
        keywords && keywords.length > 0
          ? "keyword"
          : "any_comment",

      triggerKeywords: keywords || [],

      replyMode: "single",

      // Existing Rule engine uses replies for COMMENT replies.
      replies:
        commentReplyEnabled && commentReplyMessage
          ? [commentReplyMessage]
          : [],

      isActive: automation.status === "active",
    });

    console.log("✅ Rule Created:", rule._id);

    // =========================
    // 3. Create Campaign
    // =========================
const campaignData = {
  userId: req.user.id,

  automationId: automation._id,

  name: `Automation - ${automation._id}`,

  triggerType,

  instagramMediaId,

  instagramAccountId: "",

  postIds:
    triggerType === "specific-post"
      ? [instagramMediaId]
      : [],

  status:
    automation.status === "active"
      ? "active"
      : "draft",

  ruleIds: [rule._id],

  settings: {
    enableDM: Boolean(dmMessage && dmMessage.trim()),
    enableReply: Boolean(commentReplyEnabled && commentReplyMessage),
    dmMessage: dmMessage || "",
  },

  gate: {
    gateType: followGate ? "FOLLOW" : "NONE",
    status: followGate ? "enabled" : "disabled",
    openingMessage: followGate
      ? "Follow us to unlock your DM."
      : "",
    buttonText: "I'm Following",
  },
};

console.log("========== CAMPAIGN DATA ==========");
console.dir(campaignData, { depth: null });
console.log("===================================");

const campaign = await Campaign.create(campaignData);

console.log("========== SAVED CAMPAIGN ==========");
console.dir(campaign.toObject(), { depth: null });
console.log("====================================");

    // =========================
    // 4. Return Response
    // =========================
    return res.status(201).json({
      success: true,
      automation,
      campaign,
      rule,
    });

  } catch (error) {
    console.error("CREATE AUTOMATION ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getAutomations = async (req, res) => {
  try {
    const automations = await Automation.find({
      user: req.user.id,
    }).sort({ createdAt: -1 });

    res.json(automations);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch automations",
    });
  }
};


const deleteAutomation = async (req, res) => {
  try {
    const automation = await Automation.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!automation) {
      return res.status(404).json({
        message: "Automation not found",
      });
    }

    res.json({
      message: "Automation deleted",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server error",
    });
  }
};


const updateAutomation = async (req, res) => {
  try {
    const automation =
      await Automation.findOneAndUpdate(
        {
          _id: req.params.id,
          user: req.user.id,
        },
        req.body,
        { new: true }
      );

    res.json(automation);
  } catch (err) {
    res.status(500).json({
      message: "Update failed",
    });
  }
};

module.exports = {
  createAutomation,
  getAutomations,
  deleteAutomation,
  updateAutomation,
};
