const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis({ maxRetriesPerRequest: null });

const queue = new Queue("action-queue", { connection });

async function run() {
  await queue.add("test-job", {
    action: {
      type: "reply",
      message: "check dm",
    },
    campaignId: "test123",
    commentId: "comment123",
    ruleId: "rule123",
    userId: "user123",
  });

  console.log("Job pushed");
}

run();