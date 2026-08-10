export const findMatchingRule = (comment, rules) => {
  const text = comment.toLowerCase();

  for (let rule of rules) {

    // ===============================
    // ALL COMMENTS
    // ===============================
    if (rule.triggerType === "any_comment") {
      return {
        ruleId: rule._id,
        ruleName: rule.ruleName,
        replyMode: rule.replyMode,
        replies: rule.replies,
        matchedKeyword: null,
      };
    }

    // ===============================
    // SPECIFIC KEYWORD
    // ===============================
    if (rule.triggerType === "keyword") {
      const keywords = rule.triggerKeywords || [];

      const matchedKeyword = keywords.find((k) =>
        text.includes(k.toLowerCase())
      );

      if (matchedKeyword) {
        return {
          ruleId: rule._id,
          ruleName: rule.ruleName,
          replyMode: rule.replyMode,
          replies: rule.replies,
          matchedKeyword,
        };
      }
    }
  }

  return null;
};