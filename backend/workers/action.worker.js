const MetricsService = require("../services/metrics.service");
console.log("🚀 Worker starting...");

const { classifyError } = require("../utils/errorClassifier");
const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const ActionService = require("../services/action.service");
const FailedJob = require("../models/failedJob.model");
const ActionLog = require("../models/actionLog.model");

const connection = new IORedis({
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "action-queue",
  async (job) => {
    const { action, campaignId, commentId, ruleId, userId } = job.data;

    try {
      console.log("⚡ Executing action:", action);

      // =================================================
      // 1. IDEMPOTENCY CHECK
      // =================================================
      const existing = await ActionLog.findOne({ eventId: commentId });

      if (existing?.status === "success") {
        console.log("🔁 Duplicate execution blocked:", commentId);
        return { skipped: true };
      }

      // =================================================
      // 2. MARK QUEUED (SAFE UPSERT)
      // =================================================
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
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      // =================================================
      // 3. EXECUTE ACTION
      // =================================================
      const result = await ActionService.execute(action);

      // =================================================
      // 4. MARK SUCCESS (ONLY ONCE)
      // =================================================
      const updated = await ActionLog.updateOne(
        { eventId: commentId, status: { $ne: "success" } },
        {
          $set: {
            status: "success",
            updatedAt: new Date(),
          },
        }
      );

      // =================================================
      // 5. SAFE METRICS UPDATE (ONLY FIRST SUCCESS)
      // =================================================
      if (updated.modifiedCount > 0) {
        if (action.type === "reply") {
          await MetricsService.increment(campaignId, "repliesSent");
        }

        if (action.type === "send_dm") {
          await MetricsService.increment(campaignId, "dmsSent");
        }

        await MetricsService.increment(campaignId, "commentsProcessed");
      }

      return result;
    } catch (error) {
      console.log("❌ Action failed:", error.message);

      const errorType = classifyError(error);

      const isRetryable =
        errorType !== "DUPLICATE_ACTION" &&
        errorType !== "AUTH_ERROR";

      // =================================================
      // 6. MARK FAILURE
      // =================================================
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

      // =================================================
      // 7. FAILED JOB LOG
      // =================================================
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

      await MetricsService.increment(campaignId, "errors");

      // =================================================
      // 8. STOP RETRY FOR NON-RETRYABLE ERRORS
      // =================================================
      if (!isRetryable) {
        console.log("⛔ Non-retryable error, stopping retries");
        return { failed: true, errorType };
      }

      throw error;
    }
  },
  {
    connection,
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: false,
  }
);

console.log("✅ Worker ready and waiting for jobs...");

// =================================================
// DLQ HANDLER
// =================================================
worker.on("failed", async (job, err) => {
  try {
    console.log("❌ JOB FAILED FINAL:", job.id);

    await FailedJob.create({
      jobId: job.id,
      campaignId: job.data?.campaignId,
      ruleId: job.data?.ruleId,
      userId: job.data?.userId,
      actionType: job.data?.action?.type,
      payload: job.data,
      errorMessage: err.message,
      stack: err.stack,
      attemptsMade: job.attemptsMade,
    });
  } catch (e) {
    console.log("❌ FailedJob logging failed:", e.message);
  }
});

module.exports = worker;const MetricsService = require("../services/metrics.service");
console.log("🚀 Worker starting...");

const { classifyError } = require("../utils/errorClassifier");
const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const ActionService = require("../services/action.service");
const FailedJob = require("../models/failedJob.model");
const ActionLog = require("../models/actionLog.model");

const connection = new IORedis({
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "action-queue",
  async (job) => {
    const { action, campaignId, commentId, ruleId, userId } = job.data;

    try {
      console.log("⚡ Executing action:", action);

      // =================================================
      // 1. IDEMPOTENCY CHECK
      // =================================================
      const existing = await ActionLog.findOne({ eventId: commentId });

      if (existing?.status === "success") {
        console.log("🔁 Duplicate execution blocked:", commentId);
        return { skipped: true };
      }

      // =================================================
      // 2. MARK QUEUED (SAFE UPSERT)
      // =================================================
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
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      // =================================================
      // 3. EXECUTE ACTION
      // =================================================
      const result = await ActionService.execute(action);

      // =================================================
      // 4. MARK SUCCESS (ONLY ONCE)
      // =================================================
      const updated = await ActionLog.updateOne(
        { eventId: commentId, status: { $ne: "success" } },
        {
          $set: {
            status: "success",
            updatedAt: new Date(),
          },
        }
      );

      // =================================================
      // 5. SAFE METRICS UPDATE (ONLY FIRST SUCCESS)
      // =================================================
      if (updated.modifiedCount > 0) {
        if (action.type === "reply") {
          await MetricsService.increment(campaignId, "repliesSent");
        }

        if (action.type === "send_dm") {
          await MetricsService.increment(campaignId, "dmsSent");
        }

        await MetricsService.increment(campaignId, "commentsProcessed");
      }

      return result;
    } catch (error) {
      console.log("❌ Action failed:", error.message);

      const errorType = classifyError(error);

      const isRetryable =
        errorType !== "DUPLICATE_ACTION" &&
        errorType !== "AUTH_ERROR";

      // =================================================
      // 6. MARK FAILURE
      // =================================================
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

      // =================================================
      // 7. FAILED JOB LOG
      // =================================================
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

      await MetricsService.increment(campaignId, "errors");

      // =================================================
      // 8. STOP RETRY FOR NON-RETRYABLE ERRORS
      // =================================================
      if (!isRetryable) {
        console.log("⛔ Non-retryable error, stopping retries");
        return { failed: true, errorType };
      }

      throw error;
    }
  },
  {
    connection,
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: false,
  }
);

console.log("✅ Worker ready and waiting for jobs...");

// =================================================
// DLQ HANDLER
// =================================================
worker.on("failed", async (job, err) => {
  try {
    console.log("❌ JOB FAILED FINAL:", job.id);

    await FailedJob.create({
      jobId: job.id,
      campaignId: job.data?.campaignId,
      ruleId: job.data?.ruleId,
      userId: job.data?.userId,
      actionType: job.data?.action?.type,
      payload: job.data,
      errorMessage: err.message,
      stack: err.stack,
      attemptsMade: job.attemptsMade,
    });
  } catch (e) {
    console.log("❌ FailedJob logging failed:", e.message);
  }
});

module.exports = worker;