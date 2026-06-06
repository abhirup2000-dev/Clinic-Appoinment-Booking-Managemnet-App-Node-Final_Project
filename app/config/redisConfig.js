require("dotenv").config();
const Redis = require("ioredis");

function createRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.error("Missing REDIS_URL in .env");
    process.exit(1);
  }

  const redis = new Redis(url);

  redis.on("connect", () => console.log("Redis connected successfully"));
  redis.on("error", (e) => console.error("Redis error:", e.message));

  return redis;
}

module.exports = createRedisClient;
