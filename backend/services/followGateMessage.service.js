const GateSession = require("../models/GateSession");
const InstagramAccount = require("../models/InstagramAccount");
const instagramApiService = require("./instagramApiService");

class FollowGateMessageService {
  async send(session) {
    if (!session) {
      throw new Error("GATE_SESSION_REQUIRED");
    }

    if (session.gateType !== "FOLLOW") {
      throw new Error("INVALID_GATE_TYPE");
    }

    if (session.status !== "WAITING") {
      throw new Error("GATE_SESSION_NOT_WAITING");
    }

    const account = await InstagramAccount.findById(
      session.instagramAccountId
    );

    if (!account || account.status !== "active") {
      throw new Error("NO_ACTIVE_INSTAGRAM_ACCOUNT");
    }

    const campaign = await this.getCampaign(session.campaignId);

    const gate = campaign.gate;

    if (!gate || gate.gateType !== "FOLLOW") {
      throw new Error("FOLLOW_GATE_NOT_CONFIGURED");
    }

    const openingMessage =
      gate.openingMessage?.trim() ||
      "Follow us to unlock your DM.";

    const buttonText =
      gate.buttonText?.trim() ||
      "I'm Following";

    const profileUrl =
      `https://www.instagram.com/${account.username}/`;

    console.log("📨 Sending Follow Gate message:", {
      sessionId: session._id,
      recipientId: session.recipientId,
      instagramAccount: account.username,
      profileUrl,
    });

    return await instagramApiService.sendFollowGateMessage({
      accessToken:
        account.pageAccessToken ||
        account.accessToken,

      instagramBusinessId:
        account.instagramBusinessId,

 commentId: session.commentId,

recipientId: session.recipientId,

      openingMessage,

      buttonText,

      profileUrl,

      verificationToken:
        session.verificationToken,
    });
  }

  async getCampaign(campaignId) {
    const Campaign = require("../models/campaign.model");

    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error("CAMPAIGN_NOT_FOUND");
    }

    return campaign;
  }
}

module.exports = new FollowGateMessageService();