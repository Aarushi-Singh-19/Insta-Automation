const Rule = require("../models/Rule");

const getRules = async (req, res) => {
  try {
    const rules = await Rule.find().sort({ priority: 1 });

    res.status(200).json({
      success: true,
      count: rules.length,
      rules,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching rules",
    });
  }
};

const createRule = async (req, res) => {
  try {
    const { ruleName, triggerKeywords, replies } = req.body;

    if (!ruleName || !triggerKeywords || !replies) {
      return res.status(400).json({
        success: false,
        message: "ruleName, triggerKeywords, and replies are required",
      });
    }

    const newRule = await Rule.create({
      ruleName,
      priority: 1,
      triggerType: "keywords",
      triggerKeywords,
      replyMode: "single",
      replies,
    });

    res.status(201).json({
      success: true,
      message: "Automation rule saved to database",
      rule: newRule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating rule",
    });
  }
};

module.exports = {
  getRules,
  createRule,
};