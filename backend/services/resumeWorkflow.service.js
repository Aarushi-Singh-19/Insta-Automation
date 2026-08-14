const GateSession = require("../models/GateSession");
const actionQueue = require("../queues/action.queue");

class ResumeWorkflowService {
  async resume(token) {
    if (!token) {
      throw new Error("VERIFICATION_TOKEN_REQUIRED");
    }

    // Atomically acquire the waiting session.
    // This prevents duplicate verification clicks
    // from resuming the same session twice.
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
      // Check expiration before resuming.
      if (session.expiresAt < new Date()) {
        session.status = "EXPIRED";
        await session.save();

        throw new Error("SESSION_EXPIRED");
      }

      // Currently only FOLLOW gate is supported.
      if (session.gateType !== "FOLLOW") {
        throw new Error("INVALID_GATE_TYPE");
      }

      // There must be stored actions.
      if (
        !Array.isArray(session.actions) ||
        session.actions.length === 0
      ) {
        throw new Error("NO_ACTIONS_TO_RESUME");
      }

      console.log(
        "🔓 RESUMING FOLLOW GATE:",
        session._id.toString()
      );

      console.log(
        "📦 ACTIONS TO RESUME:",
        JSON.stringify(session.actions, null, 2)
      );

      /*
       * IMPORTANT:
       *
       * Previously we created one BullMQ job per action.
       *
       * That caused the resumed send_dm action to remain
       * unprocessed even though the job was successfully
       * created.
       *
       * We now create ONE resume job containing the complete
       * immutable action snapshot.
       *
       * The worker will execute these actions sequentially.
       */

      const job = await actionQueue.add(
        "process-gate-resume",
        {
          actions: session.actions.map((action) => ({
            type: action.type,
            username: action.username,
            recipientId: action.recipientId,
            message: action.message,
            campaignId: action.campaignId,
            ruleId: action.ruleId,
          })),

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

      console.log(
        "✅ FOLLOW GATE RESUME JOB QUEUED:",
        job.id
      );

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