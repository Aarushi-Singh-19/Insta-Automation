const { Queue } = require("bullmq");
const connection = require("../config/redis");
console.log(
  "Redis URL loaded:",
  process.env.REDIS_URL ? "YES" : "NO"
);

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