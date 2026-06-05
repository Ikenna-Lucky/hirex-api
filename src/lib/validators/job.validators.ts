import { z } from "zod";

/**
 * Accepts either a full ISO-8601 datetime ("2025-01-01T00:00:00Z")
 * or a plain date string ("2025-01-01") from the frontend date picker.
 * Both are converted to a Date-safe ISO string internally.
 */
const closesAtSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val) return true;
      const d = new Date(val);
      return !isNaN(d.getTime());
    },
    { message: "closesAt must be a valid date (YYYY-MM-DD or ISO 8601)" },
  );

// Base schema without refinement so .partial() works on updateJobSchema
const baseJobSchema = z.object({
  title: z.string().min(3, "Job title must be at least 3 characters"),
  description: z
    .string()
    .min(50, "Job description must be at least 50 characters"),
  requirements: z.string().optional(),
  responsibilities: z.string().optional(),
  location: z.string().optional(),
  type: z
    .enum(["full-time", "part-time", "contract", "remote", "hybrid"])
    .optional(),
  salaryMin: z
    .union([
      z.number(),
      z.string().transform((v) => (v === "" ? undefined : Number(v))),
    ])
    .pipe(
      z
        .number()
        .positive("Minimum salary must be a positive number")
        .optional(),
    )
    .optional(),
  salaryMax: z
    .union([
      z.number(),
      z.string().transform((v) => (v === "" ? undefined : Number(v))),
    ])
    .pipe(
      z
        .number()
        .positive("Maximum salary must be a positive number")
        .optional(),
    )
    .optional(),
  salaryCurrency: z
    .string()
    .length(3, "Use a 3-letter currency code e.g. NGN, USD")
    .default("NGN"),
  // Accept YYYY-MM-DD date strings as well as full ISO datetimes
  closesAt: closesAtSchema,
  // Allow the creator to start the job as active immediately
  status: z.enum(["draft", "active"]).optional().default("draft"),
});

// Refinement applied only on create — salaryMax must be >= salaryMin
export const createJobSchema = baseJobSchema.refine(
  (data) => {
    if (data.salaryMin && data.salaryMax) {
      return data.salaryMax >= data.salaryMin;
    }
    return true;
  },
  {
    message: "Maximum salary must be greater than or equal to minimum salary",
    path: ["salaryMax"],
  },
);

// partial() called on the base schema — no refinement needed for partial updates
export const updateJobSchema = baseJobSchema.partial();

export const updateJobStatusSchema = z.object({
  status: z.enum(["draft", "active", "closed", "archived"]),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
