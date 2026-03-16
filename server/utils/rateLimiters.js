const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const { redisClient } = require('../config/database');

/**
 * Create a rate limiter that prefers Redis (distributed across instances)
 * and transparently falls back to in-memory limiter when Redis is unavailable.
 */
function createDistributedLimiter({ points, duration, keyPrefix }) {
  const memoryLimiter = new RateLimiterMemory({ points, duration, keyPrefix: `${keyPrefix}:mem` });

  const canUseRedis = Boolean(
    redisClient &&
    typeof redisClient.isReady !== 'undefined' &&
    redisClient.isReady
  );

  const limiter = canUseRedis
    ? new RateLimiterRedis({
      storeClient: redisClient,
      points,
      duration,
      keyPrefix,
      // Avoid process crash if redis hiccups; we'll fallback below.
      insuranceLimiter: memoryLimiter,
    })
    : memoryLimiter;

  return {
    async consume(key, pointsToConsume = 1) {
      try {
        return await limiter.consume(key, pointsToConsume);
      } catch (err) {
        // If redis-backed limiter failed for infra reasons, fall back to memory.
        if (canUseRedis && err && !Object.prototype.hasOwnProperty.call(err, 'msBeforeNext')) {
          return memoryLimiter.consume(key, pointsToConsume);
        }
        throw err;
      }
    }
  };
}

module.exports = {
  createDistributedLimiter,
};
