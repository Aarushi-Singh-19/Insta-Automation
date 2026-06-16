const axios = require("axios");
const InstagramAccount = require("../models/InstagramAccount");
class RetryableError extends Error {
  constructor(message, isRetryable = true) {
    super(message);
    this.isRetryable = isRetryable;
  }
}
class ActionService {

    
async execute(action, context = {}){
  try {
    if (action.type === "reply") {
      return await this.replyToComment(action, context);
    }

    if (action.type === "send_dm") {
      return await this.sendDM(action, context);
    }

    throw new Error("Unknown action type: " + action.type);
  } catch (err) {
    console.log("❌ Action failed:", err.message);

    // pass error upward so BullMQ can retry properly
    throw err;
  }
}

async replyToComment(action, context) {
  const { username, message } = action;

  const { commentId, userId } = context;

  console.log("Comment ID:", commentId);
console.log("User ID:", userId);

  console.log(`💬 Replying to @${username}: ${message}`);

  const account = await InstagramAccount.findOne({
  userId,
  status: "active",
});

if (!account) {
  throw new Error(
    "No active Instagram account connected"
  );
}

console.log(
  "Instagram Account Found:",
  account.instagramBusinessId
);

try {
  const verify = await axios.get(
    `https://graph.facebook.com/v23.0/${commentId}`,
    {
      params: {
        access_token:
          account.pageAccessToken,
      },
    }
  );

  console.log(
    "COMMENT LOOKUP SUCCESS:",
    verify.data
  );
} catch (err) {
  console.error(
    "COMMENT LOOKUP FAILED:",
    err.response?.data || err.message
  );
}

  // 🔥 simulate API risk points
  const randomFail = Math.random();

  if (randomFail < 0.1) {
    throw new RetryableError("Instagram rate limit (simulated)", true);
  }

  if (randomFail < 0.15) {
    throw new RetryableError("Instagram 5xx error (simulated)", true);
  }

  return { success: true };
}

 async sendDM(action) {
  const { username, message } = action;

  console.log(`📩 Sending DM to @${username}: ${message}`);

  const randomFail = Math.random();

  if (randomFail < 0.1) {
    throw new RetryableError("Instagram rate limit (simulated)", true);
  }

  if (randomFail < 0.15) {
    throw new RetryableError("Instagram 5xx error (simulated)", true);
  }

  return { success: true };
}
}
module.exports = new ActionService();