import { describe, it, expect, beforeEach, mock } from "bun:test";

process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "test_secret_must_be_at_least_32_chars_ok";

// In-memory store simulating Redis
const redisStore = new Map<string, number>();

mock.module("ioredis", () => ({
  default: class MockRedis {
    on() {
      return this;
    }
    async incr(key: string) {
      const val = (redisStore.get(key) ?? 0) + 1;
      redisStore.set(key, val);
      return val;
    }
    async expire() {
      return 1;
    }
  },
}));

import { Hono } from "hono";
import { rateLimit } from "../middleware/rateLimit";

function buildApp(max: number, path = "/") {
  const app = new Hono();
  app.use("*", rateLimit({ windowMs: 60_000, max }));
  app.get(path, (c) => c.json({ success: true }));
  return app;
}

describe("rateLimit middleware", () => {
  beforeEach(() => redisStore.clear());

  it("allows requests that are under the limit", async () => {
    const app = buildApp(5);
    const res = await app.request("/", {
      headers: { "x-real-ip": "1.2.3.4" },
    });
    expect(res.status).toBe(200);
  });

  it("returns 429 when the limit is exceeded", async () => {
    const app = buildApp(2);
    const ip = "10.0.0.1";

    await app.request("/", { headers: { "x-real-ip": ip } });
    await app.request("/", { headers: { "x-real-ip": ip } });
    const res = await app.request("/", { headers: { "x-real-ip": ip } });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("tracks different IPs independently", async () => {
    const app = buildApp(1);

    const res1 = await app.request("/", {
      headers: { "x-real-ip": "1.1.1.1" },
    });
    const res2 = await app.request("/", {
      headers: { "x-real-ip": "2.2.2.2" },
    });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("sets X-RateLimit-Limit header on response", async () => {
    const app = buildApp(10);
    const res = await app.request("/", { headers: { "x-real-ip": "3.3.3.3" } });
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
  });

  it("sets X-RateLimit-Remaining header on response", async () => {
    const app = buildApp(10);
    const res = await app.request("/", { headers: { "x-real-ip": "4.4.4.4" } });
    const remaining = res.headers.get("X-RateLimit-Remaining");
    expect(remaining).not.toBeNull();
    expect(Number(remaining)).toBe(9);
  });

  it("returns correct error message when rate limited", async () => {
    const app = buildApp(1);
    const ip = "5.5.5.5";

    await app.request("/", { headers: { "x-real-ip": ip } });
    const res = await app.request("/", { headers: { "x-real-ip": ip } });
    const body = await res.json();

    expect(body.message).toContain("Too many requests");
  });
});
