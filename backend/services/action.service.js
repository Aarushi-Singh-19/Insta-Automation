const instagramApiService =
  require("./instagramApiService");

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
  console.log("🚀 REPLY VERSION 2 RUNNING");
  const { username, message } = action;

  const { commentId, userId } = context;

  if (context.isSimulation) {
  console.log("✅ SIMULATION SUCCESS");
  return {
    success: true,
    simulated: true,
  };
}

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


console.log("IG ID:", account.instagramBusinessId);
console.log("PAGE ID:", account.pageId);
console.log("USERNAME:", account.username);

console.log(
  "TOKEN START:",
  account.pageAccessToken?.substring(0, 30)
);

console.log(
  "TOKEN LENGTH:",
  account.pageAccessToken?.length
);

console.log("==================================");



return await instagramApiService.replyToComment({
  accessToken: account.pageAccessToken,
  commentId,
  message,
});

  // 🔥 simulate API risk points
  // const randomFail = Math.random();

  // if (randomFail < 0.1) {
  //   throw new RetryableError("Instagram rate limit (simulated)", true);
  // }

  // if (randomFail < 0.15) {
  //   throw new RetryableError("Instagram 5xx error (simulated)", true);
  // }

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