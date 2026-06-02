const buildActionFromRule = (rule, username) => {
  return {
    type: "reply",
    message: rule.replies?.[0] || "",
    username: username,
  };
};

module.exports = { buildActionFromRule };