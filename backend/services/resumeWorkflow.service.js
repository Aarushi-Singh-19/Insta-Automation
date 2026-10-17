const GateSession = require("../models/GateSession");

class ResumeWorkflowService {
  async resume(token) {
    if (!token) {
      throw new Error("VERIFICATION_TOKEN_REQUIRED");
    }

    // Atomically acquire the waiting session.
    // This prevents duplicate verification clicks
    // from completing the same session twice.
    const session = await GateSession.findOneAndUpdate(
      {
        verificationToken: token,
        status: "WAITING",
      },
      {
        $set: {
          status: "PROCESSING",
        },
      },
      {
        new: true,
      }
    );

    if (!session) {
      throw new Error(
        "SESSION_NOT_FOUND_OR_ALREADY_PROCESSING"
      );
    }

    try {
      // Check expiration.
      if (session.expiresAt < new Date()) {
        session.status = "EXPIRED";
        await session.save();

        throw new Error("SESSION_EXPIRED");
      }

      // Currently only FOLLOW gate is supported.
      if (session.gateType !== "FOLLOW") {
        throw new Error("INVALID_GATE_TYPE");
      }

      console.log(
        "✅ FOLLOW VERIFIED:",
        session._id.toString()
      );

      console.log(
        "📌 Original comment:",
        session.commentId
      );

      console.log(
        "📌 User:",
        session.username
      );

      /*
       * IMPORTANT
       *
       * We intentionally DO NOT resume the old actions here.
       *
       * The original comment may now be outside Meta's
       * allowed messaging window.
       *
       * Instead:
       *
       * Follow verification
       *        ↓
       * GateSession completed
       *        ↓
       * User comments again
       *        ↓
       * Existing Follow Gate checks follower status
       *        ↓
       * Already following
       *        ↓
       * Gate bypassed
       *        ↓
       * Fresh comment actions are sent normally.
       */

      session.status = "COMPLETED";
      session.completedAt = new Date();

      await session.save();

      return session;

    } catch (err) {
      // If the session expired, don't move it back to WAITING.
      if (session.status !== "EXPIRED") {
        session.status = "WAITING";
        await session.save();
      }

      throw err;
    }
  }
}

module.exports = new ResumeWorkflowService();