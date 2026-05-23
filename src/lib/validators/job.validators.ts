import { z } from "zod";

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
    .number()
    .positive("Minimum salary must be a positive number")
    .optional(),
  salaryMax: z
    .number()
    .positive("Maximum salary must be a positive number")
    .optional(),
  salaryCurrency: z
    .string()
    .length(3, "Use a 3-letter currency code e.g. NGN, USD")
    .default("NGN"),
  closesAt: z.string().datetime("Invalid date format").optional(),
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
