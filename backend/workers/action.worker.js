console.log("🚀 Worker starting...");

const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const ActionService = require("../services/action.service");
const redis = require("../utils/redisClient");
const FailedJob = require("../models/failedJob.model");

const connection = new IORedis({
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "action-queue",
  async (job) => {
    const { action } = job.data;

    console.log("⚡ Executing action:", action);

    return await ActionService.execute(action);
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

// DLQ handler (you already added earlier, keep it)
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