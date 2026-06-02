const findMatchingRule = (comment, rules) => {
  const text = comment.toLowerCase();

  for (let rule of rules) {

    // ANY COMMENT (PRO FEATURE)
    if (rule.triggerType === "any_comment") {
      return rule;
    }

    const keywords = rule.triggerKeywords || [];

    const isMatch = keywords.some((kw) =>
      text.includes((kw || "").toLowerCase().trim())
    );

    if (isMatch) {
      return rule;
    }
  }

  return null;
};

module.exports = { findMatchingRule };