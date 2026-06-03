export const runRuleEngine = (comment, rules) => {
  const text = comment.toLowerCase();

  for (let rule of rules) {
    const keywords = rule.triggerKeywords || [];

    const matched = keywords.some(k =>
      text.includes(k.toLowerCase())
    );

    if (matched) {
      const replies = rule.replies || [
        "Check your DM 📩"
      ];

      const randomReply =
        replies[Math.floor(Math.random() * replies.length)];

      return {
        matched: true,
        rule,
        reply: randomReply,
        sendDM: true
      };
    }
  }

  return { matched: false };
};