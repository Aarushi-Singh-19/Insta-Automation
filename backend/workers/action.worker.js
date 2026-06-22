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

// Redis connection


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
      const {
        action,
        campaignId,
        commentId,
        ruleId,
        userId,
      } = job.data;

      console.log("JOB DATA RECEIVED:");
console.log(job.data);

console.log("WORKER USER ID:", userId);
console.log("WORKER USER ID TYPE:", typeof userId);

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
        // 2. GET INSTAGRAM ACCOUNT (FIXED)
        // =========================
        let igAccount;

        try {
console.log("LOOKING UP INSTAGRAM ACCOUNT", {
  userId,
  status: "active",
});

igAccount = await InstagramAccount.findOne({
  userId,
  status: "active",
});

console.log(
  "LOOKUP RESULT:",
  igAccount
);
        } catch (err) {
          console.error("IG lookup failed:", err.message);
          throw new Error("IG_DB_ERROR");
        }
const allAccounts =
  await InstagramAccount.find({});

console.log(
  "ALL INSTAGRAM ACCOUNTS:",
  allAccounts.map(a => ({
    id: a._id,
    userId: a.userId,
    username: a.username,
    status: a.status,
  }))
);
        if (!igAccount) {
          
          throw new Error("NO_INSTAGRAM_ACCOUNT_CONNECTED");
        }

        console.log("📸 IG ACCOUNT FOUND:", {
          igId: igAccount.instagramBusinessId,
          username: igAccount.username,
        });

        // =========================
        // 3. EXECUTE ACTION
        // =========================
        const result = await ActionService.execute(action, {
          campaignId,
          commentId,
          ruleId,
          userId,
          instagramAccount: igAccount,
        });

        console.log(
          `✅ Action executed for event ${commentId}`
        );

        // =========================
        // 4. MARK SUCCESS
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
        // 5. UPDATE METRICS
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
        // 6. MARK FAILED
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
        // 7. STORE FAILED JOB
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
        // 8. ERROR METRIC
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