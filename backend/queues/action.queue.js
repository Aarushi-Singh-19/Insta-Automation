const { Queue } = require("bullmq");
const connection = require("../config/redis");

console.log(
  "Redis URL loaded:",
  process.env.REDIS_URL ? "YES" : "NO"
);

const actionQueue = new Queue("action-queue", {
  connection,
});

module.exports = actionQueue;