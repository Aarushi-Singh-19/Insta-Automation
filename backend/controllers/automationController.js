const Automation = require("../models/Automation");

const createAutomation = async (req, res) => {
  try {
    const {
      triggerType,
      keywords,
      matchType,
      dmMessage,
      commentReplyEnabled,
      commentReplyMessage,
      followGate,
    } = req.body;

    const automation = await Automation.create({
      user: req.user.id, // we'll wire auth properly next
      triggerType,
      keywords,
      matchType,
      dmMessage,
      commentReplyEnabled,
      commentReplyMessage,
      followGate,
    });

    res.status(201).json({
      success: true,
      automation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to create automation",
    });
  }
};

module.exports = {
  createAutomation,
};