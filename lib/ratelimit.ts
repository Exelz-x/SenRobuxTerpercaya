import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// Kalau env belum ada (misal dev), jangan crash
export const redis =
  url && token ? new Redis({ url, token }) : null;

export function getRatelimiter(kind: "public" | "ticket" | "admin") {
  if (!redis) return null;

  if (kind === "admin") {
    // admin login + admin API: anti brute force
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"), // 20/min per IP
      analytics: true,
      prefix: "rl_admin",
    });
  }

  if (kind === "ticket") {
    // anti spam tiket/chat
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"), // 10/min per IP
      analytics: true,
      prefix: "rl_ticket",
    });
  }

  // public (order/create, order/get, stock/get, refresh-status)
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"), // 60/min per IP
    analytics: true,
    prefix: "rl_public",
  });
}
