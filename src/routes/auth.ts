import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { companies, subscriptions } from "../db/schema";
import { signToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { registerSchema, loginSchema } from "../lib/validators/auth.validators";

const auth = new Hono();

// ─── POST /api/auth/register ───────────────────────────
auth.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");

  // Check if email is already taken
  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.email, body.email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    return c.json(
      { success: false, message: "An account with this email already exists" },
      409,
    );
  }

  // Hash password
  const passwordHash = await Bun.password.hash(body.password, {
    algorithm: "argon2id",
    memoryCost: 4,
    timeCost: 3,
  });

  // Create company
  const [company] = await db
    .insert(companies)
    .values({
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash,
      industry: body.industry,
      size: body.size,
      website: body.website || null,
    })
    .returning({
      id: companies.id,
      name: companies.name,
      email: companies.email,
      industry: companies.industry,
      createdAt: companies.createdAt,
    });

  // Create a default inactive subscription record
  await db.insert(subscriptions).values({
    companyId: company.id,
    plan: "starter",
    status: "inactive",
  });

  // Issue JWT
  const token = await signToken({
    sub: company.id,
    email: company.email,
    name: company.name,
  });

  return c.json(
    {
      success: true,
      message: "Account created successfully",
      data: { company, token },
    },
    201,
  );
});

// ─── POST /api/auth/login ──────────────────────────────
auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");

  // Find company
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.email, body.email.toLowerCase()))
    .limit(1);

  if (!company) {
    return c.json(
      { success: false, message: "Invalid email or password" },
      401,
    );
  }

  // Verify password
  const isValid = await Bun.password.verify(
    body.password,
    company.passwordHash,
  );

  if (!isValid) {
    return c.json(
      { success: false, message: "Invalid email or password" },
      401,
    );
  }

  // Issue JWT
  const token = await signToken({
    sub: company.id,
    email: company.email,
    name: company.name,
  });

  return c.json({
    success: true,
    message: "Welcome back",
    data: {
      company: {
        id: company.id,
        name: company.name,
        email: company.email,
        logoUrl: company.logoUrl,
        industry: company.industry,
        size: company.size,
        isVerified: company.isVerified,
      },
      token,
    },
  });
});

// ─── GET /api/auth/me ──────────────────────────────────
auth.get("/me", requireAuth, async (c) => {
  const { sub } = c.get("company");

  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      email: companies.email,
      logoUrl: companies.logoUrl,
      website: companies.website,
      industry: companies.industry,
      size: companies.size,
      location: companies.location,
      description: companies.description,
      isVerified: companies.isVerified,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .where(eq(companies.id, sub))
    .limit(1);

  if (!company) {
    return c.json({ success: false, message: "Company not found" }, 404);
  }

  return c.json({ success: true, data: { company } });
});

// ─── PATCH /api/auth/profile ───────────────────────────
auth.patch("/profile", requireAuth, async (c) => {
  const { sub } = c.get("company");
  const body = await c.req.json();

  // Only allow safe fields to be updated here
  const allowed = [
    "name",
    "website",
    "industry",
    "size",
    "location",
    "description",
  ];
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return c.json(
      { success: false, message: "No valid fields to update" },
      400,
    );
  }

  const [updated] = await db
    .update(companies)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(companies.id, sub))
    .returning({
      id: companies.id,
      name: companies.name,
      email: companies.email,
      industry: companies.industry,
      size: companies.size,
      location: companies.location,
      description: companies.description,
      website: companies.website,
    });

  return c.json({
    success: true,
    message: "Profile updated",
    data: { company: updated },
  });
});

// ─── POST /api/auth/logout ─────────────────────────────
// JWT is stateless — client drops the token. This endpoint
// exists so the frontend has a clean endpoint to call.
auth.post("/logout", requireAuth, (c) => {
  return c.json({ success: true, message: "Logged out successfully" });
});

export default auth;
