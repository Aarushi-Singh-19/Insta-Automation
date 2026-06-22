const { Queue } = require("bullmq");
const connection = require("../config/redis");
console.log("REDIS CONNECTION:", connection);
console.log("QUEUE NAME: action-queue");

console.log(
  "Redis URL loaded:",
  process.env.REDIS_URL ? "YES" : "NO"
);

const actionQueue = new Queue("action-queue", {
  connection,
});

module.exports = actionQueue;