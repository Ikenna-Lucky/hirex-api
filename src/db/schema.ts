import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  numeric,
  pgEnum,
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Subscriptions ─────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  plan: text("plan").notNull().default("starter"), // starter | growth | scale
  status: subscriptionStatusEnum("status").default("inactive").notNull(),
  paystackCustomerCode: text("paystack_customer_code"),
  paystackSubscriptionCode: text("paystack_subscription_code"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Jobs ──────────────────────────────────────────────
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements"),
  responsibilities: text("responsibilities"),
  location: text("location"),
  type: text("type"), // full-time | part-time | contract | remote
  salaryMin: numeric("salary_min"),
  salaryMax: numeric("salary_max"),
  salaryCurrency: text("salary_currency").default("NGN"),
  status: jobStatusEnum("status").default("draft").notNull(),
  applicationCount: integer("application_count").default(0),
  closesAt: timestamp("closes_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Candidates ────────────────────────────────────────
export const candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Applications ──────────────────────────────────────
export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .references(() => jobs.id, { onDelete: "cascade" })
    .notNull(),
  candidateId: uuid("candidate_id")
    .references(() => candidates.id, { onDelete: "cascade" })
    .notNull(),
  cvUrl: text("cv_url").notNull(), // Cloudinary URL
  cvPublicId: text("cv_public_id"), // Cloudinary public_id
  coverLetter: text("cover_letter"),
  stage: applicationStageEnum("stage").default("applied").notNull(),
  aiScore: integer("ai_score"), // 0-100 score from Gemini
  aiSummary: text("ai_summary"), // AI-generated match summary
  aiStrengths: text("ai_strengths"), // JSON array of strengths
  aiWeaknesses: text("ai_weaknesses"), // JSON array of gaps
  scoringStatus: scoringStatusEnum("scoring_status")
    .default("pending")
    .notNull(),
  scoredAt: timestamp("scored_at"),
  notes: text("notes"), // Internal recruiter notes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Refresh Tokens ────────────────────────────────────
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Stage History (audit log) ─────────────────────────
export const stageHistory = pgTable("stage_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .references(() => applications.id, { onDelete: "cascade" })
    .notNull(),
  fromStage: applicationStageEnum("from_stage"),
  toStage: applicationStageEnum("to_stage").notNull(),
  changedBy: uuid("changed_by").references(() => companies.id),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
