import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, count, ilike, or } from "drizzle-orm";
import { db } from "../db";
import { jobs, companies } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { requireSubscription } from "../middleware/requireSubscription";
import {
  createJobSchema,
  updateJobSchema,
  updateJobStatusSchema,
} from "../lib/validators/job.validators";

const jobRoutes = new Hono();

// ─── GET /api/jobs/public ──────────────────────────────
// Public job board — no auth required. Used by candidate-facing portal.
jobRoutes.get("/public", async (c) => {
  const page = Number(c.req.query("page") || 1);
  const limit = Number(c.req.query("limit") || 20);
  const search = c.req.query("search") || "";
  const type = c.req.query("type") || "";
  const offset = (page - 1) * limit;

  const filters = [eq(jobs.status, "active")];

  if (search) {
    filters.push(
      or(
        ilike(jobs.title, `%${search}%`),
        ilike(jobs.description, `%${search}%`),
      )!,
    );
  }

  if (type) {
    filters.push(eq(jobs.type, type));
  }

  const [allJobs, [{ total }]] = await Promise.all([
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        location: jobs.location,
        type: jobs.type,
        salaryMin: jobs.salaryMin,
        salaryMax: jobs.salaryMax,
        salaryCurrency: jobs.salaryCurrency,
        applicationCount: jobs.applicationCount,
        closesAt: jobs.closesAt,
        createdAt: jobs.createdAt,
        company: {
          id: companies.id,
          name: companies.name,
          logoUrl: companies.logoUrl,
          industry: companies.industry,
          location: companies.location,
        },
      })
      .from(jobs)
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(...filters))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(jobs)
      .where(and(...filters)),
  ]);

  return c.json({
    success: true,
    data: allJobs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─── GET /api/jobs/public/:id ──────────────────────────
jobRoutes.get("/public/:id", async (c) => {
  const { id } = c.req.param();

  const [job] = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      description: jobs.description,
      requirements: jobs.requirements,
      responsibilities: jobs.responsibilities,
      location: jobs.location,
      type: jobs.type,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      salaryCurrency: jobs.salaryCurrency,
      applicationCount: jobs.applicationCount,
      closesAt: jobs.closesAt,
      createdAt: jobs.createdAt,
      company: {
        id: companies.id,
        name: companies.name,
        logoUrl: companies.logoUrl,
        website: companies.website,
        industry: companies.industry,
        description: companies.description,
        location: companies.location,
      },
    })
    .from(jobs)
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(and(eq(jobs.id, id), eq(jobs.status, "active")))
    .limit(1);

  if (!job) {
    return c.json(
      { success: false, message: "Job not found or no longer active" },
      404,
    );
  }

  return c.json({ success: true, data: job });
});

// ─── All routes below require auth ────────────────────
jobRoutes.use("*", requireAuth);

// ─── GET /api/jobs ─────────────────────────────────────
// List all jobs belonging to the authenticated company
jobRoutes.get("/", async (c) => {
  const { sub } = c.get("company");
  const page = Number(c.req.query("page") || 1);
  const limit = Number(c.req.query("limit") || 20);
  const status = c.req.query("status") || "";
  const offset = (page - 1) * limit;

  const filters = [eq(jobs.companyId, sub)];
  if (status) {
    filters.push(
      eq(jobs.status, status as "draft" | "active" | "closed" | "archived"),
    );
  }

  const [companyJobs, [{ total }]] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(and(...filters))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(jobs)
      .where(and(...filters)),
  ]);

  return c.json({
    success: true,
    data: companyJobs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─── POST /api/jobs ─────────────────────────────────────
// Create a job — requires active subscription
jobRoutes.post(
  "/",
  requireSubscription,
  zValidator("json", createJobSchema),
  async (c) => {
    const { sub } = c.get("company");
    const body = c.req.valid("json");

    const [job] = await db
      .insert(jobs)
      .values({
        companyId: sub,
        title: body.title,
        description: body.description,
        requirements: body.requirements,
        responsibilities: body.responsibilities,
        location: body.location,
        type: body.type,
        salaryMin: body.salaryMin?.toString(),
        salaryMax: body.salaryMax?.toString(),
        salaryCurrency: body.salaryCurrency,
        status: body.status ?? "draft",
        closesAt: body.closesAt ? new Date(body.closesAt) : null,
      })
      .returning();

    return c.json({ success: true, message: "Job created", data: job }, 201);
  },
);

// ─── GET /api/jobs/:id ─────────────────────────────────
jobRoutes.get("/:id", async (c) => {
  const { sub } = c.get("company");
  const { id } = c.req.param();

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.companyId, sub)))
    .limit(1);

  if (!job) {
    return c.json({ success: false, message: "Job not found" }, 404);
  }

  return c.json({ success: true, data: job });
});

// ─── PATCH /api/jobs/:id ───────────────────────────────
jobRoutes.patch("/:id", zValidator("json", updateJobSchema), async (c) => {
  const { sub } = c.get("company");
  const { id } = c.req.param();
  const body = c.req.valid("json");

  // Confirm ownership
  const [existing] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.companyId, sub)))
    .limit(1);

  if (!existing) {
    return c.json({ success: false, message: "Job not found" }, 404);
  }

  const [updated] = await db
    .update(jobs)
    .set({
      ...body,
      salaryMin: body.salaryMin?.toString(),
      salaryMax: body.salaryMax?.toString(),
      closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id))
    .returning();

  return c.json({ success: true, message: "Job updated", data: updated });
});

// ─── PATCH /api/jobs/:id/status ────────────────────────
// Dedicated endpoint for publishing, closing, or archiving a job
jobRoutes.patch(
  "/:id/status",
  zValidator("json", updateJobStatusSchema),
  async (c) => {
    const { sub } = c.get("company");
    const { id } = c.req.param();
    const { status } = c.req.valid("json");

    const [existing] = await db
      .select({ id: jobs.id, status: jobs.status })
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.companyId, sub)))
      .limit(1);

    if (!existing) {
      return c.json({ success: false, message: "Job not found" }, 404);
    }

    const [updated] = await db
      .update(jobs)
      .set({ status, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning({ id: jobs.id, status: jobs.status, title: jobs.title });

    return c.json({
      success: true,
      message: `Job ${status === "active" ? "published" : status} successfully`,
      data: updated,
    });
  },
);

// ─── DELETE /api/jobs/:id ──────────────────────────────
jobRoutes.delete("/:id", async (c) => {
  const { sub } = c.get("company");
  const { id } = c.req.param();

  const [existing] = await db
    .select({ id: jobs.id, applicationCount: jobs.applicationCount })
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.companyId, sub)))
    .limit(1);

  if (!existing) {
    return c.json({ success: false, message: "Job not found" }, 404);
  }

  // Prevent deleting a job that already has applications
  if (existing.applicationCount && existing.applicationCount > 0) {
    return c.json(
      {
        success: false,
        message:
          "This job has applications and cannot be deleted. Archive it instead.",
      },
      409,
    );
  }

  await db.delete(jobs).where(eq(jobs.id, id));

  return c.json({ success: true, message: "Job deleted" });
});

export default jobRoutes;
