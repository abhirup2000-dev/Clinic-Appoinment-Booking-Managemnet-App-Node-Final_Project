const createRedisClient = require("../config/redisConfig");

const redis = createRedisClient();

module.exports = redis;
