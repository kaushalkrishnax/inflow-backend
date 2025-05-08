import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Redis client
const redis = new Redis(process.env.REDIS_DATABASE_URL ?? '', {
  tls: process.env.NODE_ENV === 'production' ? {} : undefined, // Enable TLS only in production
  lazyConnect: true,
});

// Test Redis connection on startup
(async () => {
  try {
    await redis.connect();
    const pong = await redis.ping();
    console.log('Connected to Redis:', pong);
  } catch (err) {
    console.error('Error connecting to Redis:', err);
    process.exit(1);
  }
})();

// Handle Redis errors
redis.on('error', (err: Error) => {
  console.error('Redis error:', err);
});

// Wrapper functions for Redis operations (example)
export const rdb = {
  async get(key: string) {
    return await redis.get(key);
  },
  async set(key: string, value: string, expiryInSec?: number) {
    if (expiryInSec) {
      return await redis.set(key, value, 'EX', expiryInSec);
    }
    return await redis.set(key, value);
  },
  async del(key: string) {
    return await redis.del(key);
  },
  async exists(key: string) {
    return await redis.exists(key);
  },
};

// Export raw Redis instance if needed directly
export default redis;
