const connection = require("../config/redis");

console.log(
  "Redis URL loaded:",
  process.env.REDIS_URL ? "YES" : "NO"
);

module.exports = connection;