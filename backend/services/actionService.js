export const pickRandomReply = (replies = []) => {
  if (!replies.length) return "Thanks for your comment!";

  return replies[Math.floor(Math.random() * replies.length)];
};