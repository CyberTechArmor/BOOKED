import Redis from 'ioredis';
import { getConfig } from '../config/index.js';

let redis: Redis | undefined;

export function getRedisClient(): Redis {
  if (redis) {
    return redis;
  }

  const config = getConfig();
  redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  redis.on('connect', () => {
    console.info('Redis connected');
  });

  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = undefined;
  }
}

export { redis };
