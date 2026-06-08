const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

const connectDB = require("../config/db");


const { Worker } = require("bullmq");
const IORedis = require("ioredis");

const MetricsService = require("../services/metrics.service");
const ActionService = require("../services/action.service");
const FailedJob = require("../models/failedJob.model");
const ActionLog = require("../models/EventLog");
const { classifyError } = require("../utils/errorClassifier");

console.log("🚀 Worker starting...");

// Redis connection
const connection = new IORedis({
  maxRetriesPerRequest: null,
});

// Metric mapping
const metricMap = {
  reply: "repliesSent",
  send_dm: "dmsSent",
};

const startWorker = async () => {
  // Wait for MongoDB before creating Worker
  await connectDB();

  console.log("✅ MongoDB connected for Worker");

  const worker = new Worker(
    "action-queue",
    async (job) => {
      const { action, campaignId, commentId, ruleId, userId } = job.data;

      try {
        console.log("⚡ Executing action:", action);

        // =========================
        // 1. IDEMPOTENCY CHECK
        // =========================
        const existingSuccess = await ActionLog.findOne({
          eventId: commentId,
          status: "success",
        });

        if (existingSuccess) {
          console.log("🔁 Already processed:", commentId);
          return { skipped: true };
        }

        // Create queued log if missing
        await ActionLog.updateOne(
          { eventId: commentId },
          {
            $setOnInsert: {
              eventId: commentId,
              campaignId,
              ruleId,
              userId,
              actionType: action.type,
              status: "queued",
              metricsUpdated: false,
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );

        // =========================
        // 2. EXECUTE ACTION
        // =========================
        const result = await ActionService.execute(action);

console.log(
  `✅ Action executed for event ${commentId}`
);

        // =========================
        // 3. MARK SUCCESS
        // =========================
        await ActionLog.updateOne(
          { eventId: commentId },
          {
            $set: {
              status: "success",
              updatedAt: new Date(),
            },
          }
        );

        // =========================
        // 4. UPDATE METRICS ONCE
        // =========================
        const log = await ActionLog.findOne({
          eventId: commentId,
          metricsUpdated: { $ne: true },
        });

        if (log) {
          const metricField = metricMap[action.type];

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
            { eventId: commentId },
            {
              $set: {
                metricsUpdated: true,
              },
            }
          );
        }

        return result;
      } catch (error) {
        console.log("❌ Action failed:", error.message);

        const errorType = classifyError(error);

        const isRetryable =
          errorType !== "DUPLICATE_ACTION" &&
          errorType !== "AUTH_ERROR";

        // =========================
        // 5. MARK FAILED
        // =========================
        await ActionLog.updateOne(
          { eventId: commentId },
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
        // 6. STORE FAILED JOB
        // =========================
        await FailedJob.create({
          jobId: job.id,
          campaignId,
          ruleId,
          userId,
          actionType: action.type,
          payload: job.data,
          errorMessage: error.message,
          errorType,
          isRetryable,
          stack: error.stack,
          attemptsMade: job.attemptsMade,
        });

        // =========================
        // 7. ERROR METRIC
        // =========================
        await MetricsService.increment(
          campaignId,
          "errors"
        );

        if (!isRetryable) {
          console.log("⛔ Non-retryable error");
          return {
            failed: true,
            errorType,
          };
        }

        throw error;
      }
    },
    {
      connection,
    }
  );

  worker.on("completed", (job) => {
    console.log("🎯 Completed:", job.id);
  });

  worker.on("failed", (job, err) => {
    console.log("💥 Failed:", job?.id, err.message);
  });

  console.log("✅ Worker ready and waiting for jobs...");
};

startWorker().catch((err) => {
  console.error("❌ Worker startup failed");
  console.error(err);
  process.exit(1);
});

module.exports = {};