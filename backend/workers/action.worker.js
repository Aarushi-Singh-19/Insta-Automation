const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

const connection = require("../config/redis");
const connectDB = require("../config/db");

const { Worker } = require("bullmq");

const MetricsService = require("../services/metrics.service");
const ActionService = require("../services/action.service");

const FailedJob = require("../models/failedJob.model");
const ActionLog = require("../models/EventLog");
const InstagramAccount = require("../models/InstagramAccount.js");

const { classifyError } = require("../utils/errorClassifier");

console.log("🚀 Worker starting...");

console.log(
  "Redis URL loaded:",
  process.env.REDIS_URL ? "YES" : "NO"
);

// Metric mapping
const metricMap = {
  reply: "repliesSent",
  send_dm: "dmsSent",
};

const startWorker = async () => {
  await connectDB();

  console.log("✅ MongoDB connected for Worker");

  console.log("WORKER LISTENING ON:", "action-queue");

  const worker = new Worker(
    "action-queue",
    async (job) => {
      console.log("🔥 JOB PICKED:", job.id);

      console.log("JOB DATA RECEIVED:");
      console.log(job.data);

      const {
        action,
        actions,
        campaignId,
        commentId,
        ruleId,
        userId,
        isGateResume,
      } = job.data;

      console.log("WORKER USER ID:", userId);
      console.log("WORKER USER ID TYPE:", typeof userId);

      /*
       * ==========================================================
       * NORMAL JOB
       * ==========================================================
       *
       * Existing jobs contain:
       *
       * action: { type: "reply" | "send_dm", ... }
       *
       * We leave this behavior unchanged.
       *
       * ==========================================================
       *
       * FOLLOW GATE RESUME JOB
       * ==========================================================
       *
       * Resume jobs contain:
       *
       * actions: [
       *   reply,
       *   send_dm
       * ]
       *
       * These actions are executed sequentially inside ONE
       * BullMQ job.
       */

      const actionsToProcess =
        job.name === "process-gate-resume"
          ? Array.isArray(actions)
            ? actions
            : []
          : action
          ? [action]
          : [];

      if (actionsToProcess.length === 0) {
        throw new Error("NO_ACTIONS_TO_PROCESS");
      }

      console.log(
        "📦 ACTIONS TO PROCESS:",
        actionsToProcess.length
      );

      /*
       * Process each action sequentially.
       *
       * This preserves the order created by ActionBuilder:
       *
       * 1. reply
       * 2. send_dm
       */
      for (const currentAction of actionsToProcess) {
        const currentLogQuery = {
          eventId: commentId,
          actionType: currentAction.type,
        };

        try {
          console.log(
            "⚡ Executing action:",
            currentAction
          );

          // =========================
          // 1. ATOMIC IDEMPOTENCY CLAIM
          // =========================

          let claimedLog;

          try {
            claimedLog = await ActionLog.findOneAndUpdate(
              {
                ...currentLogQuery,
                status: "queued",
              },
              {
                $set: {
                  status: "processing",
                  updatedAt: new Date(),
                },

                $setOnInsert: {
                  eventId: commentId,
                  campaignId,
                  ruleId,
                  userId,
                  actionType: currentAction.type,
                  metricsUpdated: false,
                  createdAt: new Date(),
                },
              },
              {
                upsert: true,
                new: true,
              }
            );
          } catch (err) {
            if (err.code === 11000) {
              console.log(
                `🔁 Duplicate action prevented: ${commentId} / ${currentAction.type}`
              );

              continue;
            }

            throw err;
          }

          if (claimedLog.status !== "processing") {
            console.log(
              `🔁 Action already handled: ${commentId} / ${currentAction.type}`
            );

            continue;
          }

          console.log(
            `🔒 Action claimed: ${commentId} / ${currentAction.type}`
          );

          // =========================
          // 2. GET INSTAGRAM ACCOUNT
          // =========================

          let igAccount;

          try {
            console.log(
              "LOOKING UP INSTAGRAM ACCOUNT",
              {
                userId,
                status: "active",
              }
            );

            igAccount = await InstagramAccount.findOne({
              userId,
              status: "active",
            });

            console.log(
              "LOOKUP RESULT:",
              igAccount
                ? {
                    id: igAccount._id,
                    instagramBusinessId:
                      igAccount.instagramBusinessId,
                    username: igAccount.username,
                    status: igAccount.status,
                  }
                : null
            );
          } catch (err) {
            console.error(
              "IG lookup failed:",
              err.message
            );

            throw new Error("IG_DB_ERROR");
          }

          if (!igAccount) {
            throw new Error(
              "NO_INSTAGRAM_ACCOUNT_CONNECTED"
            );
          }

          console.log(
            "📸 IG ACCOUNT FOUND:",
            {
              igId: igAccount.instagramBusinessId,
              username: igAccount.username,
            }
          );

          // =========================
          // 3. EXECUTE ACTION
          // =========================

          const result =
            await ActionService.execute(
              currentAction,
              {
                campaignId,
                commentId,
                ruleId,
                userId,
                instagramAccount: igAccount,
                isSimulation:
                  job.data.isSimulation,
                isGateResume,
              }
            );

          console.log(
            `✅ Action executed for event ${commentId}: ${currentAction.type}`
          );

          // =========================
          // 4. MARK ACTION SUCCESS
          // =========================

          await ActionLog.updateOne(
            {
              ...currentLogQuery,
              status: "processing",
            },
            {
              $set: {
                status: "success",
                updatedAt: new Date(),
              },
            }
          );

          console.log(
            `✅ Action permanently marked SUCCESS: ${commentId} / ${currentAction.type}`
          );

          // =========================
          // 5. UPDATE METRICS
          // =========================

          try {
            const log =
              await ActionLog.findOne({
                ...currentLogQuery,
                status: "success",
                metricsUpdated: {
                  $ne: true,
                },
              });

            if (log) {
              const metricField =
                metricMap[currentAction.type];

              if (metricField) {
                await MetricsService.increment(
                  campaignId,
                  metricField
                );
              }

              await MetricsService.increment(
                campaignId,
                "commentsProcessed"
              );

              await ActionLog.updateOne(
                {
                  ...currentLogQuery,
                  status: "success",
                },
                {
                  $set: {
                    metricsUpdated: true,
                  },
                }
              );
            }
          } catch (metricError) {
            console.error(
              "⚠️ Metrics update failed after successful action:",
              metricError.message
            );
          }

        } catch (error) {
          console.log(
            "❌ Action failed:",
            error.message
          );

          const errorType =
            classifyError(error);

          const isRetryable =
            errorType !== "DUPLICATE_ACTION" &&
            errorType !== "AUTH_ERROR";

          // =========================
          // 6. MARK FAILED
          // =========================

          await ActionLog.updateOne(
            {
              ...currentLogQuery,
              status: "processing",
            },
            {
              $set: {
                status: "failed",
                error: error.message,
                errorType,
                updatedAt: new Date(),
              },
            }
          );

          // =========================
          // 7. STORE FAILED JOB
          // =========================

          await FailedJob.create({
            jobId: job.id,
            campaignId,
            ruleId,
            userId,
            actionType:
              currentAction.type,
            payload: job.data,
            errorMessage:
              error.message,
            errorType,
            isRetryable,
            stack: error.stack,
            attemptsMade:
              job.attemptsMade,
          });

          // =========================
          // 8. ERROR METRIC
          // =========================

          await MetricsService.increment(
            campaignId,
            "errors"
          );

          if (!isRetryable) {
            console.log(
              "⛔ Non-retryable error"
            );

            return {
              failed: true,
              errorType,
            };
          }

          /*
           * Throwing here causes BullMQ to retry
           * the entire job.
           *
           * On retry, already-successful actions
           * are protected by ActionLog idempotency,
           * while the failed action can continue.
           */
          throw error;
        }
      }

      console.log(
        `🎯 All actions completed for job ${job.id}`
      );

      return {
        success: true,
        actionsProcessed:
          actionsToProcess.length,
      };
    },
    {
      connection,
    }
  );

  worker.on("completed", (job) => {
    console.log(
      "🎯 Completed:",
      job.id,
      job.name
    );
  });

  worker.on("failed", (job, err) => {
    console.log(
      "💥 Failed:",
      job?.id,
      job?.name,
      err.message
    );
  });

  console.log(
    "✅ Worker ready and waiting for jobs..."
  );
};

startWorker().catch((err) => {
  console.error(
    "❌ Worker startup failed"
  );

  console.error(err);

  process.exit(1);
});

module.exports = {};