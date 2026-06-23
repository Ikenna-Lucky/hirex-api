import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  numeric,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

// ─── Enums ─────────────────────────────────────────────
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "inactive",
  "trialing",
  "cancelled",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "active",
  "closed",
  "archived",
]);

export const applicationStageEnum = pgEnum("application_stage", [
  "applied",
  "screening",
  "shortlisted",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
]);

export const scoringStatusEnum = pgEnum("scoring_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

// ─── Companies ─────────────────────────────────────────
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  logoUrl: text("logo_url"),
  website: text("website"),
  industry: text("industry"),
  size: text("size"),
  location: text("location"),
  description: text("description"),
  isVerified: boolean("is_verified").default(false),
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Subscriptions ─────────────────────────────────────
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    plan: text("plan").notNull().default("starter"),
    status: subscriptionStatusEnum("status").default("inactive").notNull(),
    paystackCustomerCode: text("paystack_customer_code"),
    paystackSubscriptionCode: text("paystack_subscription_code"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    companyIdIdx: index("subscriptions_company_id_idx").on(t.companyId),
  }),
);

// ─── Jobs ──────────────────────────────────────────────
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    requirements: text("requirements"),
    responsibilities: text("responsibilities"),
    location: text("location"),
    type: text("type"),
    salaryMin: numeric("salary_min"),
    salaryMax: numeric("salary_max"),
    salaryCurrency: text("salary_currency").default("NGN"),
    status: jobStatusEnum("status").default("draft").notNull(),
    applicationCount: integer("application_count").default(0),
    closesAt: timestamp("closes_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Most queried column — every dashboard operation filters by companyId
    companyIdIdx: index("jobs_company_id_idx").on(t.companyId),
    // Public job board filters by status constantly
    statusIdx: index("jobs_status_idx").on(t.status),
    // Compound index for the most common query: company's jobs by status
    companyStatusIdx: index("jobs_company_status_idx").on(
      t.companyId,
      t.status,
    ),
  }),
);

// ─── Candidates ────────────────────────────────────────
export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    portfolioUrl: text("portfolio_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Upsert lookup on every application submission — must be fast
    emailIdx: index("candidates_email_idx").on(t.email),
  }),
);

// ─── Applications ──────────────────────────────────────
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .references(() => jobs.id, { onDelete: "cascade" })
      .notNull(),
    candidateId: uuid("candidate_id")
      .references(() => candidates.id, { onDelete: "cascade" })
      .notNull(),
    cvUrl: text("cv_url").notNull(),
    cvPublicId: text("cv_public_id"),
    coverLetter: text("cover_letter"),
    stage: applicationStageEnum("stage").default("applied").notNull(),
    aiScore: integer("ai_score"),
    aiSummary: text("ai_summary"),
    aiStrengths: text("ai_strengths"),
    aiWeaknesses: text("ai_weaknesses"),
    scoringStatus: scoringStatusEnum("scoring_status")
      .default("pending")
      .notNull(),
    scoredAt: timestamp("scored_at"),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Most common dashboard query: all applications for a job
    jobIdIdx: index("applications_job_id_idx").on(t.jobId),
    // Duplicate-application check on submission
    candidateIdIdx: index("applications_candidate_id_idx").on(t.candidateId),
    // Prevents duplicate check queries from scanning the full table
    jobCandidateIdx: index("applications_job_candidate_idx").on(
      t.jobId,
      t.candidateId,
    ),
    // Stage filtering in candidate list view
    stageIdx: index("applications_stage_idx").on(t.stage),
    // AI worker picks up pending/processing jobs frequently
    scoringStatusIdx: index("applications_scoring_status_idx").on(
      t.scoringStatus,
    ),
  }),
);

// ─── Refresh Tokens ────────────────────────────────────
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Token lookup on every /auth/refresh call
    companyIdIdx: index("refresh_tokens_company_id_idx").on(t.companyId),
  }),
);

// ─── Stage History (audit log) ─────────────────────────
export const stageHistory = pgTable(
  "stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .references(() => applications.id, { onDelete: "cascade" })
      .notNull(),
    fromStage: applicationStageEnum("from_stage"),
    toStage: applicationStageEnum("to_stage").notNull(),
    changedBy: uuid("changed_by").references(() => companies.id),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Audit log is always fetched by applicationId
    applicationIdIdx: index("stage_history_application_id_idx").on(
      t.applicationId,
    ),
  }),
);
