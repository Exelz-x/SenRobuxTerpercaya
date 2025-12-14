import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// Kalau env belum ada (misal dev), jangan crash
export const redis =
  url && token ? new Redis({ url, token }) : null;

export function getRatelimiter(kind: "public" | "ticket" | "admin") {
  if (!redis) return null;

  // kamu bisa atur angka sesuai kebutuhan
  if (kind === "admin") {
    // admin login jangan bisa brute force
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 request / menit / IP
      analytics: true,
      prefix: "rl_admin",
    });
  }

  if (kind === "ticket") {
    // endpoint ticket rawan spam
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(8, "1 m"), // 8/min/IP
      analytics: true,
      prefix: "rl_ticket",
    });
  }

  // public api umum (order, refresh, stock get, dll)
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"), // 30/min/IP
    analytics: true,
    prefix: "rl_public",
  });
}
