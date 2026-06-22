import { describe, it, expect } from "bun:test";
import {
  signToken,
  verifyToken,
  generateRefreshToken,
  refreshTokenExpiresAt,
} from "../lib/jwt";

process.env.JWT_SECRET = "test_secret_must_be_at_least_32_chars_ok";

describe("signToken / verifyToken", () => {
  it("signs a token and verifies the payload", async () => {
    const token = await signToken({
      sub: "company-123",
      email: "hr@acme.com",
      name: "Acme Corp",
    });

    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // valid JWT structure

    const decoded = await verifyToken(token);
    expect(decoded.sub).toBe("company-123");
    expect(decoded.email).toBe("hr@acme.com");
    expect(decoded.name).toBe("Acme Corp");
  });

  it("includes iat and exp claims", async () => {
    const token = await signToken({ sub: "x", email: "x@x.com", name: "X" });
    const decoded = await verifyToken(token);
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp!).toBeGreaterThan(decoded.iat!);
  });

  it("rejects a tampered token", async () => {
    const token = await signToken({ sub: "x", email: "x@x.com", name: "X" });
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(verifyToken(tampered)).rejects.toThrow();
  });

  it("rejects a completely invalid string", () => {
    expect(verifyToken("not.a.valid.jwt")).rejects.toThrow();
  });

  it("rejects an empty string", () => {
    expect(verifyToken("")).rejects.toThrow();
  });
});

describe("generateRefreshToken", () => {
  it("returns a non-empty string", () => {
    const token = generateRefreshToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
  });

  it("generates unique tokens every call", () => {
    const tokens = Array.from({ length: 10 }, generateRefreshToken);
    const unique = new Set(tokens);
    expect(unique.size).toBe(10);
  });
});

describe("refreshTokenExpiresAt", () => {
  it("returns a date roughly 30 days in the future", () => {
    const now = new Date();
    const expires = refreshTokenExpiresAt();
    const diffDays =
      (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });

  it("returns a Date object", () => {
    expect(refreshTokenExpiresAt()).toBeInstanceOf(Date);
  });
});
