const { Queue, Worker } = require("bullmq");
const Redis = require("ioredis");

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const commentQueue = new Queue("comment-actions", {
  connection,
});

module.exports = {
  connection,
  commentQueue,
};