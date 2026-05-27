const Rule = require("../models/Rule");

const getRandomReply = (replies) => {
  const randomIndex = Math.floor(Math.random() * replies.length);
  return replies[randomIndex];
};

const findMatchingRule = async (commentText) => {
  const lowerComment = commentText.toLowerCase();

  const rules = await Rule.find({ isActive: true }).sort({ priority: 1 });

  for (const rule of rules) {
    if (rule.triggerType === "keywords") {
      const isMatched = rule.triggerKeywords.some((keyword) =>
        lowerComment.includes(keyword.toLowerCase())
      );

      if (isMatched) {
        return {
          ruleName: rule.ruleName,
          reply:
            rule.replyMode === "random"
              ? getRandomReply(rule.replies)
              : rule.replies[0],
        };
      }
    }

    if (rule.triggerType === "any") {
      return {
        ruleName: rule.ruleName,
        reply:
          rule.replyMode === "random"
            ? getRandomReply(rule.replies)
            : rule.replies[0],
      };
    }
  }

  return null;
};

const sendDM = async (username, message) => {
  console.log(`Sending DM to ${username}: ${message}`);
};

module.exports = {
  findMatchingRule,
  sendDM,
};