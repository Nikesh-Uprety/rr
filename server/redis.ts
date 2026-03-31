import "dotenv/config";
import Redis from "ioredis";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL must be set in environment variables");
}

// ioredis client for BullMQ and other queue-like use cases
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("connect", () => {
  console.log("[ioredis] connected");
});

redis.on("error", (err) => {
  console.error("[ioredis] connection error:", err);
});

// node-redis client dedicated to connect-redis session store
export const sessionRedis = createClient({
  url: redisUrl,
});

sessionRedis.on("connect", () => {
  console.log("[redis] session client connected");
});

sessionRedis.on("reconnecting", () => {
  console.log("[redis] session client reconnecting");
});

sessionRedis.on("error", (err) => {
  console.error("[redis] session client error", err);
});

if (!sessionRedis.isOpen) {
  sessionRedis.connect().catch((err) => {
    console.error("[redis] session client initial connect failed", err);
  });
}
