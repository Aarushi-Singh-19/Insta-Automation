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