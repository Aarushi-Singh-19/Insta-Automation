const Automation = require("../models/Automation");
const Campaign = require("../models/campaign.model");
const Rule = require("../models/Rule");

const createAutomation = async (req, res) => {
  try {
    const {
      triggerType,
      instagramMediaId,
      commentTriggerType,
      keywords,
      dmMessage,
      dmButtons = [],
      commentReplyEnabled,
      commentReplyMessage,
      followGate,
    } = req.body;

    // 1. Save the automation.
    const normalizedButtons = Array.isArray(dmButtons)
      ? dmButtons
          .slice(0, 3)
          .filter(
            (button) =>
              button &&
              typeof button.title === "string" &&
              typeof button.url === "string"
          )
      : [];

    const automation = await Automation.create({
      user: req.user.id,
      triggerType,
      instagramMediaId,
      commentTriggerType,
      keywords,
      dmMessage,
      dmButtons: normalizedButtons,
      commentReplyEnabled,
      commentReplyMessage,
      followGate,
    });

    console.log("✅ Automation Saved:", automation._id);

    // 2. Create the matching rule.
    const rule = await Rule.create({
      userId: req.user.id,
      ruleName: `Automation - ${automation._id}`,
      postId: triggerType === "specific-post" ? instagramMediaId : "",
      triggerType: commentTriggerType,
      triggerKeywords:
        commentTriggerType === "keyword" ? keywords || [] : [],
      replyMode: "single",
      replies:
        commentReplyEnabled && commentReplyMessage
          ? [commentReplyMessage]
          : [],
      isActive: automation.status === "active",
    });

    console.log("✅ Rule Created:", rule._id);

    // 3. Create a campaign and keep the custom DM buttons with it.
    const campaignData = {
      userId: req.user.id,
      automationId: automation._id,
      name: `Automation - ${automation._id}`,
      triggerType,
      instagramMediaId,
      instagramAccountId: "",
      postIds: triggerType === "specific-post" ? [instagramMediaId] : [],
      status: automation.status === "active" ? "active" : "draft",
      ruleIds: [rule._id],
      settings: {
        enableDM: Boolean(dmMessage && dmMessage.trim()),
        enableReply: Boolean(commentReplyEnabled && commentReplyMessage),
        dmMessage: dmMessage || "",
        dmButtons: normalizedButtons,
      },
      gate: {
        gateType: followGate ? "FOLLOW" : "NONE",
        status: followGate ? "enabled" : "disabled",
        openingMessage: followGate ? "Follow us to unlock your DM." : "",
        buttonText: "I'm Following",
      },
    };

    const campaign = await Campaign.create(campaignData);

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
    const automation = await Automation.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user.id,
      },
      req.body,
      { new: true, runValidators: true }
    );

    if (!automation) {
      return res.status(404).json({
        message: "Automation not found",
      });
    }

    const dmButtons = Array.isArray(automation.dmButtons)
      ? automation.dmButtons.slice(0, 3)
      : [];

    // Some older campaigns predate the automationId link. Match those by
    // their existing deterministic name so editing the automation also
    // updates the campaign actually used by the comment processor.
    const campaign = await Campaign.findOneAndUpdate(
      {
        userId: req.user.id,
        $or: [
          { automationId: automation._id },
          { name: `Automation - ${automation._id}` },
        ],
      },
      {
        $set: {
          automationId: automation._id,
          "settings.dmMessage": automation.dmMessage || "",
          "settings.dmButtons": dmButtons,
          "settings.enableDM": Boolean(
            automation.dmMessage && automation.dmMessage.trim()
          ),
        },
      },
      { new: true }
    );

    console.log("AUTOMATION UPDATE SYNC:", {
      automationId: automation._id,
      campaignId: campaign?._id || null,
      buttonCount: dmButtons.length,
    });

    res.json(automation);
  } catch (err) {
    console.error("UPDATE AUTOMATION ERROR:", err);
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
