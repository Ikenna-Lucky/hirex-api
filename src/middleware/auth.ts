import type { Context, Next } from "hono";
import { verifyToken } from "../lib/jwt";
import type { JwtPayload } from "../types";

// Extend Hono context so routes can access c.get("company")
declare module "hono" {
  interface ContextVariableMap {
    company: JwtPayload;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      { success: false, message: "Unauthorised — no token provided" },
      401,
    );
  }

  const token = authHeader.slice(7);

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
