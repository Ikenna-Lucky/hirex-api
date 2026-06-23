import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { db } from "../db";
import {
  companies,
  subscriptions,
  jobs,
  applications,
  candidates,
} from "../db/schema";
import {
  signToken,
  generateRefreshToken,
  refreshTokenExpiresAt,
} from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { registerSchema, loginSchema } from "../lib/validators/auth.validators";
import { uploadLogo } from "../lib/cloudinary";
import { refreshTokens } from "../db/schema";

const auth = new Hono();

const isProd = process.env.NODE_ENV === "production";

// Set both tokens as httpOnly cookies so JS cannot read them
function setAuthCookies(
  c: Parameters<typeof setCookie>[0],
  accessToken: string,
  refreshToken: string,
) {
  setCookie(c, "accessToken", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    maxAge: 15 * 60, // 15 minutes
    path: "/",
  });
  setCookie(c, "refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });
}

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

  const accessToken = await signToken({
    sub: company.id,
    email: company.email,
    name: company.name,
  });

  const refreshToken = generateRefreshToken();
  await db.insert(refreshTokens).values({
    companyId: company.id,
    token: refreshToken,
    expiresAt: refreshTokenExpiresAt(),
  });

  setAuthCookies(c, accessToken, refreshToken);

  return c.json(
    {
      success: true,
      message: "Account created successfully",
      data: { company },
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

  // Check if account is locked
  if (company.lockedUntil && company.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (company.lockedUntil.getTime() - Date.now()) / 60000,
    );
    return c.json(
      {
        success: false,
        message: `Account locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
      },
      429,
    );
  }

  // Verify password
  const isValid = await Bun.password.verify(
    body.password,
    company.passwordHash,
  );

  if (!isValid) {
    const attempts = (company.failedLoginAttempts ?? 0) + 1;
    const locked = attempts >= 5;

    await db
      .update(companies)
      .set({
        failedLoginAttempts: attempts,
        lockedUntil: locked ? new Date(Date.now() + 15 * 60 * 1000) : null,
      })
      .where(eq(companies.id, company.id));

    return c.json(
      {
        success: false,
        message: locked
          ? "Too many failed attempts. Account locked for 15 minutes."
          : "Invalid email or password",
      },
      401,
    );
  }

  // Successful login — reset failed attempts
  await db
    .update(companies)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(companies.id, company.id));

  const accessToken = await signToken({
    sub: company.id,
    email: company.email,
    name: company.name,
  });

  const refreshToken = generateRefreshToken();
  await db.insert(refreshTokens).values({
    companyId: company.id,
    token: refreshToken,
    expiresAt: refreshTokenExpiresAt(),
  });

  setAuthCookies(c, accessToken, refreshToken);

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

// ─── GET /api/auth/stats ──────────────────────────────
// Dashboard overview stats — all counts in a single round-trip.
auth.get("/stats", requireAuth, async (c) => {
  const { sub } = c.get("company");

  // Run all queries in parallel for speed
  const [
    jobCountRows,
    applicationCountRows,
    stageCountRows,
    recentJobs,
    candidateCountRows,
    pendingScoringRows,
  ] = await Promise.all([
    // Jobs by status
    db
      .select({ status: jobs.status, count: count() })
      .from(jobs)
      .where(eq(jobs.companyId, sub))
      .groupBy(jobs.status),

    // Total applications across all company jobs
    db
      .select({ total: count() })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(jobs.companyId, sub)),

    // Applications broken down by stage
    db
      .select({ stage: applications.stage, count: count() })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(jobs.companyId, sub))
      .groupBy(applications.stage),

    // Most recent 5 jobs with their application counts
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        status: jobs.status,
        type: jobs.type,
        location: jobs.location,
        applicationCount: jobs.applicationCount,
        createdAt: jobs.createdAt,
        closesAt: jobs.closesAt,
      })
      .from(jobs)
      .where(eq(jobs.companyId, sub))
      .orderBy(desc(jobs.createdAt))
      .limit(5),

    // Unique candidates who applied to this company
    db
      .select({ total: count(sql`DISTINCT ${applications.candidateId}`) })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(jobs.companyId, sub)),

    // CVs awaiting AI scoring (pending or processing)
    db
      .select({ total: count() })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(
        and(
          eq(jobs.companyId, sub),
          sql`${applications.scoringStatus} IN ('pending', 'processing')`,
        ),
      ),
  ]);

  // Roll up job counts by status
  const jobsByStatus = jobCountRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = Number(r.count);
    return acc;
  }, {});

  // Roll up application counts by stage
  const applicationsByStage = stageCountRows.reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.stage] = Number(r.count);
      return acc;
    },
    {},
  );

  const totalJobs = jobCountRows.reduce((s, r) => s + Number(r.count), 0);
  const totalApplications = Number(applicationCountRows[0]?.total ?? 0);
  const totalCandidates = Number(candidateCountRows[0]?.total ?? 0);
  const pendingScoring = Number(pendingScoringRows[0]?.total ?? 0);
  const activeJobs = jobsByStatus["active"] ?? 0;
  const draftJobs = jobsByStatus["draft"] ?? 0;
  const closedJobs = jobsByStatus["closed"] ?? 0;
  const shortlisted = applicationsByStage["shortlisted"] ?? 0;
  const interviewed = applicationsByStage["interview"] ?? 0;
  const offered = applicationsByStage["offer"] ?? 0;

  return c.json({
    success: true,
    data: {
      jobs: {
        total: totalJobs,
        active: activeJobs,
        draft: draftJobs,
        closed: closedJobs,
      },
      applications: {
        total: totalApplications,
        pendingScoring,
        shortlisted,
        interviewed,
        offered,
        byStage: applicationsByStage,
      },
      candidates: {
        total: totalCandidates,
      },
      recentJobs,
    },
  });
});

// ─── POST /api/auth/profile/logo ──────────────────────
// Upload / replace the company logo. Accepts multipart/form-data
// with a single field named "logo" (JPEG / PNG / WebP, ≤ 5 MB).
auth.post("/profile/logo", requireAuth, async (c) => {
  const { sub } = c.get("company");

  const formData = await c.req.parseBody();
  const file = formData.logo;

  if (!file || !(file instanceof File)) {
    return c.json({ success: false, message: "Logo file is required" }, 400);
  }

  const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!ALLOWED.includes(file.type)) {
    return c.json(
      { success: false, message: "Logo must be a JPEG, PNG, or WebP image" },
      400,
    );
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_SIZE) {
    return c.json({ success: false, message: "Logo must be under 5 MB" }, 400);
  }

  // Upload new logo
  let logoUrl: string;

  try {
    const upload = await uploadLogo(file);
    logoUrl = upload.url;
  } catch {
    return c.json(
      { success: false, message: "Failed to upload logo. Please try again." },
      500,
    );
  }

  // Persist the new logo URL
  await db
    .update(companies)
    .set({ logoUrl, updatedAt: new Date() })
    .where(eq(companies.id, sub));

  return c.json({
    success: true,
    message: "Logo updated successfully",
    data: { logoUrl },
  });
});

// ─── POST /api/auth/refresh ────────────────────────────
auth.post("/refresh", async (c) => {
  const { getCookie } = await import("hono/cookie");
  const refreshToken = getCookie(c, "refreshToken");

  if (!refreshToken) {
    return c.json({ success: false, message: "Refresh token required" }, 400);
  }

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, refreshToken))
    .limit(1);

  if (!stored || stored.expiresAt < new Date()) {
    return c.json(
      { success: false, message: "Invalid or expired refresh token" },
      401,
    );
  }

  // Rotate — delete old token and issue a new pair
  await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

  const [company] = await db
    .select({ id: companies.id, email: companies.email, name: companies.name })
    .from(companies)
    .where(eq(companies.id, stored.companyId))
    .limit(1);

  if (!company) {
    return c.json({ success: false, message: "Company not found" }, 401);
  }

  const newAccessToken = await signToken({
    sub: company.id,
    email: company.email,
    name: company.name,
  });

  const newRefreshToken = generateRefreshToken();
  await db.insert(refreshTokens).values({
    companyId: company.id,
    token: newRefreshToken,
    expiresAt: refreshTokenExpiresAt(),
  });

  setAuthCookies(c, newAccessToken, newRefreshToken);

  return c.json({ success: true, data: {} });
});

// ─── POST /api/auth/logout ─────────────────────────────
auth.post("/logout", requireAuth, async (c) => {
  const { getCookie } = await import("hono/cookie");
  const refreshToken = getCookie(c, "refreshToken");

  if (refreshToken) {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
  }

  // Clear both auth cookies
  deleteCookie(c, "accessToken", { path: "/" });
  deleteCookie(c, "refreshToken", { path: "/" });

  return c.json({ success: true, message: "Logged out successfully" });
});

export default auth;
