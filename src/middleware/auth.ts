import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken } from "../lib/jwt";
import type { JwtPayload } from "../types";

// Extend Hono context so routes can access c.get("company")
declare module "hono" {
  interface ContextVariableMap {
    company: JwtPayload;
  }
}

export async function requireAuth(c: Context, next: Next) {
  // Prefer httpOnly cookie — fall back to Authorization header for non-browser clients
  const cookieToken = getCookie(c, "accessToken");
  const authHeader = c.req.header("Authorization");
  const token =
    cookieToken ||
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

  if (!token) {
    return c.json(
      { success: false, message: "Unauthorised — no token provided" },
      401,
    );
  }

  try {
    const payload = await verifyToken(token);
    c.set("company", payload);
    await next();
  } catch {
    return c.json(
      { success: false, message: "Unauthorised — invalid or expired token" },
      401,
    );
  }
}
