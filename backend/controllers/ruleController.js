const { automationRules } = require("../data/automationRules");

const getRules = (req, res) => {
  res.status(200).json({
    success: true,
    count: automationRules.length,
    rules: automationRules,
  });
};

const createRule = (req, res) => {
  const { ruleName, triggerKeywords, replies } = req.body;

  if (!ruleName || !triggerKeywords || !replies) {
    return res.status(400).json({
      success: false,
      message: "ruleName, triggerKeywords, and replies are required",
    });
  }

  const newRule = {
    ruleName,
    priority: automationRules.length + 1,
    triggerType: "keywords",
    triggerKeywords,
    replyMode: "single",
    replies,
  };

  automationRules.push(newRule);

  res.status(201).json({
    success: true,
    message: "Automation rule created successfully",
    rule: newRule,
  });
};

module.exports = {
  getRules,
  createRule,
};