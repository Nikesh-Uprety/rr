import "dotenv/config";
import Redis from "ioredis";
import { log } from "./index";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL must be set in environment variables");
}

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Essential for BullMQ
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("connect", () => {
  log("Connected to Upstash Redis", "redis");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export default redis;
