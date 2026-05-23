import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { db } from "../db";
import {
  applications,
  candidates,
  jobs,
  companies,
  stageHistory,
} from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { uploadCV } from "../lib/cloudinary";
import { enqueueCvScoring } from "../lib/queue";
import { sendStageEmail } from "../lib/email";
import {
  submitApplicationSchema,
  updateStageSchema,
} from "../lib/validators/application.validators";

const applicationRoutes = new Hono();

// ─── POST /api/applications/:jobId ────────────────────
// Public — candidate submits their application with CV upload
applicationRoutes.post("/:jobId", async (c) => {
  const { jobId } = c.req.param();

  // Parse multipart form
  const formData = await c.req.parseBody();

  // Validate text fields
  const parsed = submitApplicationSchema.safeParse({
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    phone: formData.phone || undefined,
    linkedinUrl: formData.linkedinUrl || undefined,
    portfolioUrl: formData.portfolioUrl || undefined,
    coverLetter: formData.coverLetter || undefined,
  });

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      },
      422,
    );
  }

  const body = parsed.data;

  // Validate CV file
  const cvFile = formData.cv;

  if (!cvFile || !(cvFile instanceof File)) {
    return c.json({ success: false, message: "CV file is required" }, 400);
  }

  if (cvFile.type !== "application/pdf") {
    return c.json({ success: false, message: "CV must be a PDF file" }, 400);
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (cvFile.size > MAX_SIZE) {
    return c.json(
      { success: false, message: "CV file must be under 5MB" },
      400,
    );
  }

  // Verify job exists and is accepting applications
  const [job] = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      description: jobs.description,
      requirements: jobs.requirements,
      status: jobs.status,
      closesAt: jobs.closesAt,
      company: {
        name: companies.name,
      },
    })
    .from(jobs)
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!job) {
    return c.json({ success: false, message: "Job not found" }, 404);
  }

  if (job.status !== "active") {
    return c.json(
      {
        success: false,
        message: "This job is no longer accepting applications",
      },
      409,
    );
  }

  if (job.closesAt && new Date() > job.closesAt) {
    return c.json(
      {
        success: false,
        message: "The application window for this job has closed",
      },
      409,
    );
  }

  // Upsert candidate by email
  let candidate = (
    await db
      .select()
      .from(candidates)
      .where(eq(candidates.email, body.email.toLowerCase()))
      .limit(1)
  )[0];

  if (!candidate) {
    [candidate] = await db
      .insert(candidates)
      .values({
        email: body.email.toLowerCase(),
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        linkedinUrl: body.linkedinUrl || null,
        portfolioUrl: body.portfolioUrl || null,
      })
      .returning();
  }

  // Block duplicate applications
  const [existing] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.jobId, jobId),
        eq(applications.candidateId, candidate.id),
      ),
    )
    .limit(1);

  if (existing) {
    return c.json(
      { success: false, message: "You have already applied for this position" },
      409,
    );
  }

  // Upload CV to Cloudinary
  let cvUrl: string;
  let cvPublicId: string;

  try {
    const upload = await uploadCV(cvFile);
    cvUrl = upload.url;
    cvPublicId = upload.publicId;
  } catch {
    return c.json(
      { success: false, message: "Failed to upload CV. Please try again." },
      500,
    );
  }

  // Create application record
  const [application] = await db
    .insert(applications)
    .values({
      jobId,
      candidateId: candidate.id,
      cvUrl,
      cvPublicId,
      coverLetter: body.coverLetter,
      stage: "applied",
      scoringStatus: "pending",
    })
    .returning();

  // Increment job application count
  await db
    .update(jobs)
    .set({
      applicationCount: sql`${jobs.applicationCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));

  // Push CV scoring job to BullMQ queue
  await enqueueCvScoring({
    applicationId: application.id,
    jobId: job.id,
    cvUrl,
    jobTitle: job.title,
    jobDescription: job.description,
    requirements: job.requirements ?? null,
  });

  // Send confirmation email — fire and forget, don't block the response
  sendStageEmail({
    candidateFirstName: candidate.firstName,
    candidateEmail: candidate.email,
    jobTitle: job.title,
    companyName: job.company.name,
    stage: "applied",
  }).catch((err) =>
    console.error("[Email] Failed to send application confirmation:", err),
  );

  return c.json(
    {
      success: true,
      message: "Application submitted successfully. We will be in touch.",
      data: {
        applicationId: application.id,
        stage: application.stage,
      },
    },
    201,
  );
});

// ─── All routes below require company auth ────────────
applicationRoutes.use("*", requireAuth);

// ─── GET /api/applications/job/:jobId ─────────────────
// List all applications for a specific job (company only)
applicationRoutes.get("/job/:jobId", async (c) => {
  const { sub } = c.get("company");
  const { jobId } = c.req.param();
  const page = Number(c.req.query("page") || 1);
  const limit = Number(c.req.query("limit") || 20);
  const stage = c.req.query("stage") || "";
  const offset = (page - 1) * limit;

  // Confirm the job belongs to this company
  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, sub)))
    .limit(1);

  if (!job) {
    return c.json({ success: false, message: "Job not found" }, 404);
  }

  const filters = [eq(applications.jobId, jobId)];
  if (stage) {
    filters.push(
      eq(
        applications.stage,
        stage as
          | "applied"
          | "screening"
          | "shortlisted"
          | "interview"
          | "offer"
          | "rejected"
          | "withdrawn",
      ),
    );
  }

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: applications.id,
        stage: applications.stage,
        aiScore: applications.aiScore,
        aiSummary: applications.aiSummary,
        aiStrengths: applications.aiStrengths,
        aiWeaknesses: applications.aiWeaknesses,
        scoringStatus: applications.scoringStatus,
        cvUrl: applications.cvUrl,
        coverLetter: applications.coverLetter,
        createdAt: applications.createdAt,
        candidate: {
          id: candidates.id,
          firstName: candidates.firstName,
          lastName: candidates.lastName,
          email: candidates.email,
          phone: candidates.phone,
          linkedinUrl: candidates.linkedinUrl,
          portfolioUrl: candidates.portfolioUrl,
        },
      })
      .from(applications)
      .innerJoin(candidates, eq(applications.candidateId, candidates.id))
      .where(and(...filters))
      .orderBy(desc(applications.aiScore), desc(applications.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(applications)
      .where(and(...filters)),
  ]);

  return c.json({
    success: true,
    data: rows,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ─── GET /api/applications/:id ────────────────────────
// Get a single application (company must own the job)
applicationRoutes.get("/:id", async (c) => {
  const { sub } = c.get("company");
  const { id } = c.req.param();

  const [row] = await db
    .select({
      id: applications.id,
      stage: applications.stage,
      aiScore: applications.aiScore,
      aiSummary: applications.aiSummary,
      aiStrengths: applications.aiStrengths,
      aiWeaknesses: applications.aiWeaknesses,
      scoringStatus: applications.scoringStatus,
      cvUrl: applications.cvUrl,
      coverLetter: applications.coverLetter,
      notes: applications.notes,
      scoredAt: applications.scoredAt,
      createdAt: applications.createdAt,
      candidate: {
        id: candidates.id,
        firstName: candidates.firstName,
        lastName: candidates.lastName,
        email: candidates.email,
        phone: candidates.phone,
        linkedinUrl: candidates.linkedinUrl,
        portfolioUrl: candidates.portfolioUrl,
      },
      job: {
        id: jobs.id,
        title: jobs.title,
        companyId: jobs.companyId,
      },
    })
    .from(applications)
    .innerJoin(candidates, eq(applications.candidateId, candidates.id))
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(and(eq(applications.id, id), eq(jobs.companyId, sub)))
    .limit(1);

  if (!row) {
    return c.json({ success: false, message: "Application not found" }, 404);
  }

  return c.json({ success: true, data: row });
});

// ─── PATCH /api/applications/:id/stage ────────────────
// Move application to a new hiring stage
applicationRoutes.patch(
  "/:id/stage",
  zValidator("json", updateStageSchema),
  async (c) => {
    const { sub } = c.get("company");
    const { id } = c.req.param();
    const { stage, note } = c.req.valid("json");

    // Verify ownership through the job — also fetch data needed for emails
    const [row] = await db
      .select({
        applicationId: applications.id,
        currentStage: applications.stage,
        jobCompanyId: jobs.companyId,
        jobTitle: jobs.title,
        companyName: companies.name,
        candidateFirstName: candidates.firstName,
        candidateEmail: candidates.email,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .innerJoin(candidates, eq(applications.candidateId, candidates.id))
      .where(and(eq(applications.id, id), eq(jobs.companyId, sub)))
      .limit(1);

    if (!row) {
      return c.json({ success: false, message: "Application not found" }, 404);
    }

    if (row.currentStage === stage) {
      return c.json(
        {
          success: false,
          message: `Application is already at the "${stage}" stage`,
        },
        400,
      );
    }

    // Update stage and log history in parallel
    const [updated] = await db
      .update(applications)
      .set({ stage, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning({ id: applications.id, stage: applications.stage });

    await db.insert(stageHistory).values({
      applicationId: id,
      fromStage: row.currentStage,
      toStage: stage,
      changedBy: sub,
      note: note ?? null,
    });

    // Notify candidate — fire and forget
    sendStageEmail({
      candidateFirstName: row.candidateFirstName,
      candidateEmail: row.candidateEmail,
      jobTitle: row.jobTitle,
      companyName: row.companyName,
      stage,
    }).catch((err) =>
      console.error(`[Email] Failed to send stage email (${stage}):`, err),
    );

    return c.json({
      success: true,
      message: `Candidate moved to "${stage}"`,
      data: updated,
    });
  },
);

// ─── PATCH /api/applications/:id/notes ────────────────
// Save internal recruiter notes on an application
applicationRoutes.patch("/:id/notes", async (c) => {
  const { sub } = c.get("company");
  const { id } = c.req.param();
  const { notes } = await c.req.json();

  if (typeof notes !== "string") {
    return c.json({ success: false, message: "Notes must be a string" }, 400);
  }

  const [row] = await db
    .select({ applicationId: applications.id })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(and(eq(applications.id, id), eq(jobs.companyId, sub)))
    .limit(1);

  if (!row) {
    return c.json({ success: false, message: "Application not found" }, 404);
  }

  await db
    .update(applications)
    .set({ notes, updatedAt: new Date() })
    .where(eq(applications.id, id));

  return c.json({ success: true, message: "Notes saved" });
});

export default applicationRoutes;
