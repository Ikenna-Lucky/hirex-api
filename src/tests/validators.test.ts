import { describe, it, expect } from "bun:test";
import { registerSchema, loginSchema } from "../lib/validators/auth.validators";
import {
  createJobSchema,
  updateJobSchema,
  updateJobStatusSchema,
} from "../lib/validators/job.validators";

// ─── Auth validators ───────────────────────────────────

describe("registerSchema", () => {
  const valid = {
    name: "Acme Corp",
    email: "hr@acme.com",
    password: "Password123",
  };

  it("accepts valid registration data", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects name shorter than 2 characters", () => {
    expect(registerSchema.safeParse({ ...valid, name: "A" }).success).toBe(
      false,
    );
  });

  it("rejects an invalid email address", () => {
    expect(
      registerSchema.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("rejects password with no uppercase letter", () => {
    expect(
      registerSchema.safeParse({ ...valid, password: "password123" }).success,
    ).toBe(false);
  });

  it("rejects password with no number", () => {
    expect(
      registerSchema.safeParse({ ...valid, password: "PasswordOnly" }).success,
    ).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    expect(
      registerSchema.safeParse({ ...valid, password: "Pa1" }).success,
    ).toBe(false);
  });

  it("rejects an invalid website URL", () => {
    expect(
      registerSchema.safeParse({ ...valid, website: "not-a-url" }).success,
    ).toBe(false);
  });

  it("accepts an empty string as website", () => {
    expect(registerSchema.safeParse({ ...valid, website: "" }).success).toBe(
      true,
    );
  });

  it("accepts a valid website URL", () => {
    expect(
      registerSchema.safeParse({ ...valid, website: "https://acme.com" })
        .success,
    ).toBe(true);
  });

  it("accepts valid company size values", () => {
    const sizes = ["1-10", "11-50", "51-200", "201-500", "500+"];
    for (const size of sizes) {
      expect(registerSchema.safeParse({ ...valid, size }).success).toBe(true);
    }
  });

  it("rejects an invalid company size", () => {
    expect(registerSchema.safeParse({ ...valid, size: "huge" }).success).toBe(
      false,
    );
  });
});

describe("loginSchema", () => {
  it("accepts valid login credentials", () => {
    expect(
      loginSchema.safeParse({ email: "hr@acme.com", password: "anypass" })
        .success,
    ).toBe(true);
  });

  it("rejects a missing email", () => {
    expect(loginSchema.safeParse({ password: "anypass" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(
      loginSchema.safeParse({ email: "bademail", password: "anypass" }).success,
    ).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(
      loginSchema.safeParse({ email: "hr@acme.com", password: "" }).success,
    ).toBe(false);
  });
});

// ─── Job validators ────────────────────────────────────

describe("createJobSchema", () => {
  const valid = {
    title: "Backend Developer",
    description:
      "We are looking for an experienced backend developer to build scalable REST APIs for our platform.",
  };

  it("accepts valid job data", () => {
    expect(createJobSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects title shorter than 3 characters", () => {
    expect(createJobSchema.safeParse({ ...valid, title: "AI" }).success).toBe(
      false,
    );
  });

  it("rejects description shorter than 50 characters", () => {
    expect(
      createJobSchema.safeParse({ ...valid, description: "Too short." })
        .success,
    ).toBe(false);
  });

  it("rejects salaryMax less than salaryMin", () => {
    expect(
      createJobSchema.safeParse({
        ...valid,
        salaryMin: 200000,
        salaryMax: 100000,
      }).success,
    ).toBe(false);
  });

  it("accepts salaryMax equal to salaryMin", () => {
    expect(
      createJobSchema.safeParse({
        ...valid,
        salaryMin: 100000,
        salaryMax: 100000,
      }).success,
    ).toBe(true);
  });

  it("accepts all valid job types", () => {
    const types = ["full-time", "part-time", "contract", "remote", "hybrid"];
    for (const type of types) {
      expect(createJobSchema.safeParse({ ...valid, type }).success).toBe(true);
    }
  });

  it("rejects an unknown job type", () => {
    expect(
      createJobSchema.safeParse({ ...valid, type: "casual" }).success,
    ).toBe(false);
  });

  it("rejects a currency code that is not 3 characters", () => {
    expect(
      createJobSchema.safeParse({ ...valid, salaryCurrency: "US" }).success,
    ).toBe(false);
  });

  it("defaults status to draft when not provided", () => {
    const result = createJobSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
    }
  });

  it("accepts a valid ISO date string for closesAt", () => {
    expect(
      createJobSchema.safeParse({ ...valid, closesAt: "2027-12-31" }).success,
    ).toBe(true);
  });

  it("rejects an invalid date string for closesAt", () => {
    expect(
      createJobSchema.safeParse({ ...valid, closesAt: "not-a-date" }).success,
    ).toBe(false);
  });
});

describe("updateJobSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateJobSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial update with just a title", () => {
    expect(
      updateJobSchema.safeParse({ title: "Senior Backend Developer" }).success,
    ).toBe(true);
  });
});

describe("updateJobStatusSchema", () => {
  it("accepts all valid statuses", () => {
    const statuses = ["draft", "active", "closed", "archived"];
    for (const status of statuses) {
      expect(updateJobStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    expect(updateJobStatusSchema.safeParse({ status: "deleted" }).success).toBe(
      false,
    );
  });

  it("rejects a missing status field", () => {
    expect(updateJobStatusSchema.safeParse({}).success).toBe(false);
  });
});
