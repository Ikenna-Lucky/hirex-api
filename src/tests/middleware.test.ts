import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { signToken } from "../lib/jwt";

process.env.JWT_SECRET = "test_secret_must_be_at_least_32_chars_ok";

function buildApp() {
  const app = new Hono();
  app.use("*", requireAuth);
  app.get("/protected", (c) =>
    c.json({ success: true, data: c.get("company") }),
  );
  return app;
}

describe("requireAuth middleware", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await buildApp().request("/protected");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("rejects a request with wrong Authorization scheme", async () => {
    const res = await buildApp().request("/protected", {
      headers: { Authorization: "Basic abc123" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects a request with a malformed token", async () => {
    const res = await buildApp().request("/protected", {
      headers: { Authorization: "Bearer this.is.not.valid" },
    });
    expect(res.status).toBe(401);
  });

  it("allows a valid token and sets company on context", async () => {
    const token = await signToken({
      sub: "company-abc",
      email: "test@co.com",
      name: "Test Corp",
    });

    const res = await buildApp().request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.sub).toBe("company-abc");
    expect(body.data.email).toBe("test@co.com");
    expect(body.data.name).toBe("Test Corp");
  });

  it("rejects a token signed with a different secret", async () => {
    // Manually craft a token signed with wrong secret
    const { SignJWT } = await import("jose");
    const wrongSecret = new TextEncoder().encode(
      "a_completely_different_secret_key_xyz",
    );
    const badToken = await new SignJWT({
      sub: "x",
      email: "x@x.com",
      name: "X",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(wrongSecret);

    const res = await buildApp().request("/protected", {
      headers: { Authorization: `Bearer ${badToken}` },
    });
    expect(res.status).toBe(401);
  });
});
