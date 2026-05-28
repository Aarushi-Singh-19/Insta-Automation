const selectReply = (rule) => {
  if (!rule || !rule.replies || rule.replies.length === 0) {
    return null;
  }

  if (rule.replyMode === "random") {
    const randomIndex = Math.floor(Math.random() * rule.replies.length);
    return rule.replies[randomIndex];
  }

  return rule.replies[0];
};

module.exports = { selectReply };