import type { MiddlewareHandler } from "hono";
import Redis from "ioredis";
import { config } from "../lib/config";

// Lazy singleton — created on first request so test mocks are in place before instantiation
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    redis.on("error", (err) => {
      console.error("[RateLimit] Redis error:", err.message);
    });
  }
  return redis;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const {
    windowMs,
    max,
    message = "Too many requests. Please try again later.",
  } = options;

  const windowSecs = Math.ceil(windowMs / 1000);

  return async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
      c.req.header("x-real-ip") ||
      "unknown";

    const key = `rl:${c.req.routePath}:${ip}`;

    try {
      const r = getRedis();
      const current = await r.incr(key);
      if (current === 1) {
        await r.expire(key, windowSecs);
      }

      c.header("X-RateLimit-Limit", String(max));
      c.header("X-RateLimit-Remaining", String(Math.max(0, max - current)));

      if (current > max) {
        return c.json({ success: false, message }, 429);
      }
    } catch {
      // If Redis is down, fail open — don't block legitimate traffic
    }

    await next();
  };
}

// Preset limiters for different route types
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many attempts. Please try again in 15 minutes.",
});

export const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
});
