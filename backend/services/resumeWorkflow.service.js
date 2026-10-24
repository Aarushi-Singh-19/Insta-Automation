const GateSession = require("../models/GateSession");
const actionQueue = require("../queues/action.queue");

class ResumeWorkflowService {
  async resume(token) {
    if (!token) {
      throw new Error("VERIFICATION_TOKEN_REQUIRED");
    }

    // Atomically claim the waiting session so concurrent clicks
    // cannot enqueue the same workflow at the same time.
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
      if (session.expiresAt < new Date()) {
        session.status = "EXPIRED";
        await session.save();
        throw new Error("SESSION_EXPIRED");
      }

      if (session.gateType !== "FOLLOW") {
        throw new Error("INVALID_GATE_TYPE");
      }

      if (!Array.isArray(session.actions) || session.actions.length === 0) {
        throw new Error("NO_ACTIONS_TO_RESUME");
      }

      // GateSession stores action snapshots with the original recipient,
      // message, campaign and rule. Reuse them instead of requiring a new
      // Instagram comment. The stable job ID prevents duplicate queue jobs.
      await actionQueue.add(
        "process-gate-resume",
        {
          actions: session.actions.map((action) => {
            const snapshot =
              typeof action.toObject === "function"
                ? action.toObject()
                : action;

            return {
              ...snapshot,
              campaignId: snapshot.campaignId || session.campaignId,
              ruleId: snapshot.ruleId || session.ruleId,
              recipientId: snapshot.recipientId || session.recipientId,
              username: snapshot.username || session.username,
            };
          }),
          campaignId: session.campaignId.toString(),
          commentId: session.commentId,
          ruleId: session.ruleId.toString(),
          userId: session.userId.toString(),
          isGateResume: true,
        },
        {
          jobId: `gate-resume-${session._id.toString()}`,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        }
      );

      session.status = "COMPLETED";
      session.completedAt = new Date();
      await session.save();

      console.log("FOLLOW GATE WORKFLOW QUEUED", {
        sessionId: session._id.toString(),
        commentId: session.commentId,
        actions: session.actions.length,
      });

      return session;
    } catch (err) {
      // If queueing failed, restore the session so verification can be retried.
      // An expired session remains expired.
      if (session.status !== "EXPIRED") {
        session.status = "WAITING";
        await session.save();
      }
      throw err;
    }
  }
}

module.exports = new ResumeWorkflowService();
