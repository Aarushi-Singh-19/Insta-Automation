class RetryableError extends Error {
  constructor(message, isRetryable = true) {
    super(message);
    this.isRetryable = isRetryable;
  }
}
class ActionService {

    
 async execute(action) {
  try {
    if (action.type === "reply") {
      return await this.replyToComment(action);
    }

    if (action.type === "send_dm") {
      return await this.sendDM(action);
    }

    throw new Error("Unknown action type: " + action.type);
  } catch (err) {
    console.log("❌ Action failed:", err.message);

    // pass error upward so BullMQ can retry properly
    throw err;
  }
}

async replyToComment(action) {
  const { username, message } = action;

  console.log(`💬 Replying to @${username}: ${message}`);

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