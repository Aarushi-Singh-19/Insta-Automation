const IORedis = require("ioredis");

const redis = new IORedis({
  maxRetriesPerRequest: null,
});

module.exports = redis;
