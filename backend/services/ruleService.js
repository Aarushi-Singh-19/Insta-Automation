const Rule = require("../models/Rule");

const getMatchingRule = async (commentText) => {
  const rules = await Rule.find({ isActive: true }).sort({ priority: -1 });

  for (const rule of rules) {
    const matched = rule.triggerKeywords.some((keyword) =>
      commentText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matched) {
      return rule;
    }
  }

  return null;
};

module.exports = { getMatchingRule };