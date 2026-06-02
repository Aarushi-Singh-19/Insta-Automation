const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis({
  maxRetriesPerRequest: null,
});

const actionQueue = new Queue("action-queue", {
  connection,
});

module.exports = actionQueue;