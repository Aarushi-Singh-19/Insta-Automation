const Rule = require("../models/Rule");

const createRule = async (req, res) => {
  try {
    const {
      ruleName,
      priority,
      triggerType,
      triggerKeywords,
      replyMode,
      replies,
      isActive,
    } = req.body;

    const rule = await Rule.create({
      ruleName,
      priority,
      triggerType,
      triggerKeywords,
      replyMode,
      replies,
      isActive,
    });

    res.status(201).json({
      success: true,
      message: "Rule created successfully",
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating rule",
      error: error.message,
    });
  }
};

module.exports = { createRule };