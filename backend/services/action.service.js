const instagramApiService = require("./instagramApiService");
const InstagramAccount = require("../models/InstagramAccount");

class ActionService {
  async execute(action, context = {}) {
    try {
      if (action.type === "reply") {
        return await this.replyToComment(action, context);
      }

      if (action.type === "send_dm") {
        return await this.sendDM(action, context);
      }

      throw new Error("Unknown action type: " + action.type);
    } catch (err) {
      console.log("Action failed:", err.message);
      throw err;
    }
  }

  async replyToComment(action, context) {
    const { username, message } = action;
    const { commentId, userId } = context;

    if (context.isSimulation) {
      console.log("Simulation success");
      return {
        success: true,
        simulated: true,
      };
    }

    console.log("Comment ID:", commentId);
    console.log("User ID:", userId);
    console.log(`Replying to @${username}: ${message}`);

    const account = await InstagramAccount.findOne({
      userId,
      status: "active",
    });

    if (!account) {
      throw new Error("No active Instagram account connected");
    }

    return await instagramApiService.replyToComment({
      accessToken: account.pageAccessToken,
      commentId,
      message,
    });
  }

  async sendDM(action, context = {}) {
    const { username, message } = action;
    const { commentId, userId, instagramAccount } = context;

    console.log(`Sending DM to @${username}: ${message}`);

    if (context.isSimulation) {
      return {
        success: true,
        simulated: true,
      };
    }

    if (!commentId) {
      throw new Error("COMMENT_ID_REQUIRED_FOR_DM");
    }

    const account =
      instagramAccount ||
      (await InstagramAccount.findOne({
        userId,
        status: "active",
      }));

    if (!account) {
      throw new Error("No active Instagram account connected");
    }

    return await instagramApiService.sendDM({
      accessToken:
        account.pageAccessToken || account.accessToken,
      instagramBusinessId:
        account.instagramBusinessId,
      commentId,
      recipientId: action.recipientId,
      message,
    });
  }
}

module.exports = new ActionService();
