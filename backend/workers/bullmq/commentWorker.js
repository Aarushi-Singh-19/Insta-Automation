const { Worker } = require("bullmq");
const { connection } = require("./connection");
const { processJob } = require("../processors/jobProcessor");

const commentWorker = new Worker(
  "comment-actions",
  async (job) => {
    return await processJob(job);
  },
  {
    connection,
    concurrency: 5, // scalable but safe for Instagram limits
  }
);

commentWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

commentWorker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

module.exports = commentWorker;