import { z } from "zod";

export const submitApplicationSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  linkedinUrl: z
    .string()
    .url("Enter a valid LinkedIn URL")
    .optional()
    .or(z.literal("")),
  portfolioUrl: z
    .string()
    .url("Enter a valid portfolio URL")
    .optional()
    .or(z.literal("")),
  coverLetter: z
    .string()
    .max(2000, "Cover letter must be under 2000 characters")
    .optional(),
});

export const updateStageSchema = z.object({
  stage: z.enum([
    "applied",
    "screening",
    "shortlisted",
    "interview",
    "offer",
    "rejected",
    "withdrawn",
  ]),
  note: z.string().max(500).optional(),
});

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
