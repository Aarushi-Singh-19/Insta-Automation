const GateSession = require("../models/GateSession");
const actionQueue = require("../queues/action.queue");

class ResumeWorkflowService {
  async resume(token) {
    if (!token) {
      throw new Error("VERIFICATION_TOKEN_REQUIRED");
    }

    // Atomically acquire the waiting session.
    // This prevents duplicate clicks from resuming the same session twice.
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
      throw new Error("SESSION_NOT_FOUND_OR_ALREADY_PROCESSING");
    }

    try {
      // Check expiration before resuming the workflow.
      if (session.expiresAt < new Date()) {
        session.status = "EXPIRED";
        await session.save();

        throw new Error("SESSION_EXPIRED");
      }

      // Currently only FOLLOW gate is supported.
      if (session.gateType !== "FOLLOW") {
        throw new Error("INVALID_GATE_TYPE");
      }

      // There must be stored actions to resume.
      // We never rebuild the workflow here.
      if (!Array.isArray(session.actions) || session.actions.length === 0) {
        throw new Error("NO_ACTIONS_TO_RESUME");
      }

      // Re-queue the exact action snapshot created before
      // the workflow was paused.
      for (const action of session.actions) {
        await actionQueue.add(
          "process-comment",
          {
            action,

            campaignId: session.campaignId,

            commentId: session.commentId,

            ruleId: session.ruleId,

            userId: session.userId,

            username: session.username,

            recipientId: session.recipientId,

            isGateResume: true,

            receivedAt: new Date(),
          },
          {
            attempts: 3,

            backoff: {
              type: "exponential",
              delay: 5000,
            },

            removeOnComplete: 1000,

            removeOnFail: 5000,
          }
        );
      }

      // All actions were successfully added to BullMQ.
      session.status = "COMPLETED";
      session.completedAt = new Date();

      await session.save();

      return session;
    } catch (err) {
      // If the session expired, do not move it back to WAITING.
      if (session.status !== "EXPIRED") {
        session.status = "WAITING";
        await session.save();
      }

      throw err;
    }
  }
}

module.exports = new ResumeWorkflowService();