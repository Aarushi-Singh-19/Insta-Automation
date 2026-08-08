const GateSession = require("../models/GateSession");
const InstagramAccount = require("../models/InstagramAccount");
const instagramApiService = require("./instagramApiService");

class FollowVerificationService {
  async verify(token) {
    // 1. Load GateSession using the public verification token
    const session = await GateSession.findOne({
      verificationToken: token,
    });

    if (!session) {
      throw new Error("GATE_SESSION_NOT_FOUND");
    }

    // 2. Only WAITING sessions can be verified
    if (session.status !== "WAITING") {
      throw new Error("SESSION_NOT_WAITING");
    }

    // 3. Check expiration
    if (session.expiresAt < new Date()) {
      session.status = "EXPIRED";
      await session.save();

      throw new Error("SESSION_EXPIRED");
    }

    // 4. Validate gate type
    if (session.gateType !== "FOLLOW") {
      throw new Error("INVALID_GATE_TYPE");
    }

    // 5. Load the exact Instagram account associated
    // with this GateSession.
    if (!session.instagramAccountId) {
      throw new Error("INSTAGRAM_ACCOUNT_NOT_ATTACHED_TO_SESSION");
    }

    const account = await InstagramAccount.findOne({
      _id: session.instagramAccountId,
      userId: session.userId,
      status: "active",
    });

    if (!account) {
      throw new Error("NO_ACTIVE_INSTAGRAM_ACCOUNT");
    }

    // 6. Verify that the commenter follows the business.
    //
    // recipientId is the Instagram-scoped ID of the commenter.
    // Meta returns:
    //
    // is_user_follow_business === true
    //      → commenter follows the business
    //
    // is_user_follow_business === false
    //      → commenter does not follow the business
    const profile = await instagramApiService.getUserProfile({
      accessToken:
        account.pageAccessToken || account.accessToken,

      instagramScopedUserId: session.recipientId,
    });

    // 7. Return verification result only.
    // This service does NOT resume the workflow.
    return {
      verified: profile.is_user_follow_business === true,
      session,
      profile,
    };
  }
}

module.exports = new FollowVerificationService();