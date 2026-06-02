// backend/services/replyService.js

const getDefaultReplies = () => {
  return [
    "Got your message 👍",
    "We’ll DM you shortly 🚀",
    "Thanks for commenting!"
  ];
};

const pickRandomReply = (replies) => {
  if (!replies || replies.length === 0) return null;
  return replies[Math.floor(Math.random() * replies.length)];
};

module.exports = {
  getDefaultReplies,
  pickRandomReply,
};