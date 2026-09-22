// utils/redisClient.js
const { createClient } = require('redis');

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redis.on('error', (err) => console.error('Redis Client Error', err));

let isConnected = false;

async function getRedisClient() {
  if (!isConnected) {
    await redis.connect();
    isConnected = true;
  }
  return redis;
}

module.exports = { getRedisClient };