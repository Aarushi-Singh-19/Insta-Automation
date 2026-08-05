const findMatchingRule = (comment, rules) => {
  if (!comment || !rules?.length) return null;

  const text = comment.toLowerCase().trim();

  for (let rule of rules) {
    if (!rule) continue;

    // ANY COMMENT (PRO FEATURE)
    if (rule.triggerType === "any_comment") {
      return rule;
    }

    const keywords = Array.isArray(rule.triggerKeywords)
      ? rule.triggerKeywords
      : [];

    for (let kw of keywords) {
      if (!kw) continue;

  const cleanKw = String(kw).toLowerCase().trim();

console.log({
  comment: text,
  keyword: cleanKw,
  matched: text.includes(cleanKw),
});

if (cleanKw && text.includes(cleanKw)) {
  console.log("RULE MATCH FOUND");
  return rule;
}
    }
  }

  return null;
};

module.exports = { findMatchingRule };