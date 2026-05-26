const checkKeywordMatch = (commentText, triggerKeyword) => {
  if (!commentText || !triggerKeyword) {
    return false;
  }

  return commentText.toLowerCase().includes(triggerKeyword.toLowerCase());
};

module.exports = { checkKeywordMatch };