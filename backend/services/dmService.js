const { automationRules } = require("../data/automationRules");

const getRandomReply = (replies) => {
  const randomIndex = Math.floor(Math.random() * replies.length);
  return replies[randomIndex];
};

const findMatchingRule = (commentText) => {
  const lowerComment = commentText.toLowerCase();

  const sortedRules = automationRules.sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
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