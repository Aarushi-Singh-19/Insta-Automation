
const GateSession = require("../models/GateSession");
const actionQueue = require("../queues/action.queue");

class ResumeWorkflowService {
  async resume(token) {
    if (!token) {
      throw new Error("VERIFICATION_TOKEN_REQUIRED");
    }

    // Atomically claim the session so simultaneous clicks
    // cannot independently queue the same workflow.
    const session = await GateSession.findOneAndUpdate(
      {
        verificationToken: token,
        status: "WAITING",
      },
      {
        $set: { status: "PROCESSING" },
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
      if (session.expiresAt < new Date()) {
        session.status = "EXPIRED";
        await session.save();
        throw new Error("SESSION_EXPIRED");
      }

      if (session.gateType !== "FOLLOW") {
        throw new Error("INVALID_GATE_TYPE");
      }

      if (!Array.isArray(session.actions) ||
          session.actions.length === 0) {
        throw new Error("NO_ACTIONS_TO_RESUME");
      }

      const actions = session.actions.map((action) =>
        typeof action.toObject === "function"
          ? action.toObject()
          : action
      );

      // Use the existing worker's dedicated resume-job format.
      // Keep the original comment ID for reply and deduplication.
      const job = await actionQueue.add(
        "process-gate-resume",
        {
          actions,
          campaignId: session.campaignId,
          commentId: session.commentId,
          ruleId: session.ruleId,
          userId: session.userId,
          username: session.username,
          recipientId: session.recipientId,
          isGateResume: true,
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

      // Mark completed only after BullMQ accepts the job.
      session.status = "COMPLETED";
      session.completedAt = new Date();
      await session.save();

      console.log("FOLLOW GATE RESUME QUEUED:", {
        sessionId: session._id.toString(),
        jobId: job.id,
        actionCount: actions.length,
      });

      return session;
    } catch (err) {
      // Preserve terminal states. Allow recovery after other
      // failures, including a queue or database failure.
      if (
        session.status !== "EXPIRED" &&
        session.status !== "COMPLETED"
      ) {
        session.status = "WAITING";
        await session.save();
      }

      throw err;
    }
  }
}

module.exports = new ResumeWorkflowService();
