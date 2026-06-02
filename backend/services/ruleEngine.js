export const findMatchingRule = (comment, rules) => {
  const text = comment.toLowerCase();

  for (let rule of rules) {
    const keywords = rule.triggerKeywords || [];

    const matched = keywords.some((k) =>
      text.includes(k.toLowerCase())
    );

    if (matched) {
      return {
        ruleId: rule._id,
        ruleName: rule.ruleName,
        replyMode: rule.replyMode,
        replies: rule.replies,
        matchedKeyword: keywords.find(k =>
          text.includes(k.toLowerCase())
        )
      };
    }
  }

  return null;
};