import { Hono } from "hono";
import { eq, and, desc, count, inArray, or, ilike } from "drizzle-orm";
import { db } from "../db";
import { candidates, applications, jobs } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const candidateRoutes = new Hono();

// All candidate routes require company auth
candidateRoutes.use("*", requireAuth);

// ─── GET /api/candidates ───────────────────────────────
// List all candidates who have applied to any of this company's jobs.
// Each row includes the candidate's most recent application + job title.
candidateRoutes.get("/", async (c) => {
  const { sub } = c.get("company");
  const page = Number(c.req.query("page") || 1);
  const limit = Number(c.req.query("limit") || 20);
  const stage = c.req.query("stage") || "";
  const search = (c.req.query("search") || "").trim();
  const offset = (page - 1) * limit;

  // Step 1: get all job IDs belonging to this company
  const companyJobs = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.companyId, sub));

  if (companyJobs.length === 0) {
    return c.json({
      success: true,
      data: [],
      meta: { total: 0, page, limit, totalPages: 0 },
    });
  }

  const jobIds = companyJobs.map((j) => j.id);

  // Step 2: build filters
  const filters = [inArray(applications.jobId, jobIds)];
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
  if (search) {
    filters.push(
      or(
        ilike(candidates.firstName, `%${search}%`),
        ilike(candidates.lastName, `%${search}%`),
        ilike(candidates.email, `%${search}%`),
      ) as ReturnType<typeof eq>,
    );
  }

  // Step 3: paginated applications joined with candidates + job title
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        candidateId: candidates.id,
        firstName: candidates.firstName,
        lastName: candidates.lastName,
        email: candidates.email,
        phone: candidates.phone,
        linkedinUrl: candidates.linkedinUrl,
        portfolioUrl: candidates.portfolioUrl,
        applicationId: applications.id,
        stage: applications.stage,
        aiScore: applications.aiScore,
        aiSummary: applications.aiSummary,
        scoringStatus: applications.scoringStatus,
        cvUrl: applications.cvUrl,
        appliedAt: applications.createdAt,
        jobId: jobs.id,
        jobTitle: jobs.title,
      })
      .from(applications)
      .innerJoin(candidates, eq(applications.candidateId, candidates.id))
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(and(...filters))
      .orderBy(desc(applications.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(applications)
      .where(and(...filters)),
  ]);

  const data = rows.map((r) => ({
    id: r.candidateId,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone,
    linkedinUrl: r.linkedinUrl,
    portfolioUrl: r.portfolioUrl,
    latestApplication: {
      id: r.applicationId,
      stage: r.stage,
      aiScore: r.aiScore,
      aiSummary: r.aiSummary,
      scoringStatus: r.scoringStatus,
      cvUrl: r.cvUrl,
      appliedAt: r.appliedAt,
      job: { id: r.jobId, title: r.jobTitle },
    },
  }));

  return c.json({
    success: true,
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ─── GET /api/candidates/:id ───────────────────────────
// Full candidate profile + every application they've made to this company's jobs.
candidateRoutes.get("/:id", async (c) => {
  const { sub } = c.get("company");
  const { id } = c.req.param();

  // Verify this candidate has applied to at least one of this company's jobs
  const [check] = await db
    .select({ candidateId: candidates.id })
    .from(candidates)
    .innerJoin(applications, eq(applications.candidateId, candidates.id))
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(and(eq(candidates.id, id), eq(jobs.companyId, sub)))
    .limit(1);

  if (!check) {
    return c.json({ success: false, message: "Candidate not found" }, 404);
  }

  // Fetch full candidate record
  const [candidate] = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      email: candidates.email,
      phone: candidates.phone,
      linkedinUrl: candidates.linkedinUrl,
      portfolioUrl: candidates.portfolioUrl,
      createdAt: candidates.createdAt,
    })
    .from(candidates)
    .where(eq(candidates.id, id))
    .limit(1);

  // All company job IDs
  const companyJobs = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.companyId, sub));

  const jobIds = companyJobs.map((j) => j.id);

  const candidateApplications =
    jobIds.length > 0
      ? await db
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
            job: {
              id: jobs.id,
              title: jobs.title,
              status: jobs.status,
            },
          })
          .from(applications)
          .innerJoin(jobs, eq(applications.jobId, jobs.id))
          .where(
            and(
              eq(applications.candidateId, id),
              inArray(applications.jobId, jobIds),
            ),
          )
          .orderBy(desc(applications.createdAt))
      : [];

  return c.json({
    success: true,
    data: {
      ...candidate,
      applications: candidateApplications,
      applicationCount: candidateApplications.length,
    },
  });
});

export default candidateRoutes;
