/**
 * OpenAPI 3.0 specification for the HireX API.
 * Served at GET /api/docs/spec.json
 * Swagger UI rendered at GET /api/docs
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "HireX API",
    version: "1.0.0",
    description:
      "REST API powering the HireX AI recruitment platform — auth, jobs, applications, AI scoring, and subscription billing.",
    contact: {
      name: "HireX Support",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Current server",
    },
  ],

  // ─── Security Schemes ──────────────────────────────────
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "accessToken",
        description:
          "httpOnly JWT cookie set on login. Automatically included by the browser. For testing via Swagger UI, log in first via POST /auth/login, then requests on the same origin will carry the cookie automatically.",
      },
    },

    schemas: {
      // ─── Shared ───────────────────────────────────────
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string" },
        },
      },
      PaginationMeta: {
        type: "object",
        properties: {
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },

      // ─── Auth ─────────────────────────────────────────
      RegisterInput: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", minLength: 2, example: "Acme Corp" },
          email: {
            type: "string",
            format: "email",
            example: "hr@acmecorp.com",
          },
          password: {
            type: "string",
            minLength: 8,
            description:
              "Must contain at least one uppercase letter and one number",
            example: "Secret123",
          },
          industry: { type: "string", example: "Technology" },
          size: {
            type: "string",
            enum: ["1-10", "11-50", "51-200", "201-500", "500+"],
            example: "11-50",
          },
          website: {
            type: "string",
            format: "uri",
            example: "https://acmecorp.com",
          },
        },
      },
      LoginInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "hr@acmecorp.com",
          },
          password: { type: "string", example: "Secret123" },
        },
      },
      Company: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          logoUrl: { type: "string", nullable: true },
          website: { type: "string", nullable: true },
          industry: { type: "string", nullable: true },
          size: { type: "string", nullable: true },
          location: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          isVerified: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },

      // ─── Jobs ─────────────────────────────────────────
      JobInput: {
        type: "object",
        required: ["title", "description"],
        properties: {
          title: {
            type: "string",
            minLength: 3,
            example: "Senior Backend Engineer",
          },
          description: {
            type: "string",
            minLength: 50,
            example: "We are looking for an experienced backend engineer...",
          },
          requirements: { type: "string", nullable: true },
          responsibilities: { type: "string", nullable: true },
          location: { type: "string", example: "Lagos, Nigeria" },
          type: {
            type: "string",
            enum: ["full-time", "part-time", "contract", "remote", "hybrid"],
            example: "remote",
          },
          salaryMin: { type: "number", example: 500000 },
          salaryMax: { type: "number", example: 1000000 },
          salaryCurrency: { type: "string", default: "NGN", example: "NGN" },
          closesAt: {
            type: "string",
            format: "date",
            example: "2025-12-31",
            description: "Accepts YYYY-MM-DD or full ISO 8601",
          },
          status: {
            type: "string",
            enum: ["draft", "active"],
            default: "draft",
          },
        },
      },
      Job: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          companyId: { type: "string", format: "uuid" },
          title: { type: "string" },
          description: { type: "string" },
          requirements: { type: "string", nullable: true },
          responsibilities: { type: "string", nullable: true },
          location: { type: "string", nullable: true },
          type: { type: "string" },
          status: {
            type: "string",
            enum: ["draft", "active", "closed", "archived"],
          },
          salaryMin: { type: "string", nullable: true },
          salaryMax: { type: "string", nullable: true },
          salaryCurrency: { type: "string" },
          applicationCount: { type: "integer" },
          closesAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      PublicJob: {
        allOf: [
          { $ref: "#/components/schemas/Job" },
          {
            type: "object",
            properties: {
              company: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  logoUrl: { type: "string", nullable: true },
                  industry: { type: "string", nullable: true },
                  location: { type: "string", nullable: true },
                },
              },
            },
          },
        ],
      },

      // ─── Applications ─────────────────────────────────
      ApplicationInput: {
        type: "object",
        required: ["firstName", "lastName", "email", "cv"],
        properties: {
          firstName: { type: "string", minLength: 2, example: "Amara" },
          lastName: { type: "string", minLength: 2, example: "Okafor" },
          email: {
            type: "string",
            format: "email",
            example: "amara@example.com",
          },
          phone: { type: "string", example: "+2348012345678" },
          linkedinUrl: {
            type: "string",
            format: "uri",
            example: "https://linkedin.com/in/amara",
          },
          portfolioUrl: { type: "string", format: "uri" },
          coverLetter: {
            type: "string",
            maxLength: 2000,
            example: "I am excited to apply for this position...",
          },
          cv: {
            type: "string",
            format: "binary",
            description: "PDF file, max 5 MB",
          },
        },
      },
      Application: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          stage: {
            type: "string",
            enum: [
              "applied",
              "screening",
              "shortlisted",
              "interview",
              "offer",
              "rejected",
              "withdrawn",
            ],
          },
          aiScore: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            nullable: true,
          },
          aiSummary: { type: "string", nullable: true },
          aiStrengths: {
            type: "array",
            items: { type: "string" },
            nullable: true,
          },
          aiWeaknesses: {
            type: "array",
            items: { type: "string" },
            nullable: true,
          },
          scoringStatus: {
            type: "string",
            enum: ["pending", "processing", "completed", "failed"],
          },
          cvUrl: { type: "string", format: "uri" },
          coverLetter: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          scoredAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          candidate: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              firstName: { type: "string" },
              lastName: { type: "string" },
              email: { type: "string", format: "email" },
              phone: { type: "string", nullable: true },
              linkedinUrl: { type: "string", nullable: true },
              portfolioUrl: { type: "string", nullable: true },
            },
          },
        },
      },
      UpdateStageInput: {
        type: "object",
        required: ["stage"],
        properties: {
          stage: {
            type: "string",
            enum: [
              "applied",
              "screening",
              "shortlisted",
              "interview",
              "offer",
              "rejected",
              "withdrawn",
            ],
          },
          note: { type: "string", maxLength: 500 },
        },
      },

      // ─── Subscriptions ────────────────────────────────
      Plan: {
        type: "object",
        properties: {
          key: { type: "string", enum: ["starter", "growth", "scale"] },
          name: { type: "string" },
          priceNGN: { type: "integer" },
          jobLimit: {
            type: "integer",
            nullable: true,
            description: "null = unlimited",
          },
          tagline: { type: "string" },
          features: { type: "array", items: { type: "string" } },
        },
      },
    },
  },

  // ─── Paths ─────────────────────────────────────────────
  paths: {
    // ── Health ──────────────────────────────────────────
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description:
          "Returns service status. Used by UptimeRobot and load balancers.",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "HireX API" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Auth ────────────────────────────────────────────
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a company account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Account created. Auth cookies are set.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: { type: "string" },
                    data: {
                      type: "object",
                      properties: {
                        company: { $ref: "#/components/schemas/Company" },
                      },
                    },
                  },
                },
              },
            },
          },
          "409": {
            description: "Email already registered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        description:
          "Authenticates and sets httpOnly `accessToken` (15 min) and `refreshToken` (30 days) cookies. After calling this endpoint via Swagger UI the cookies are stored in your browser, so subsequent protected requests will work automatically.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        company: { $ref: "#/components/schemas/Company" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": {
            description:
              "Account locked after 5 failed attempts (15 min lockout)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout",
        security: [{ cookieAuth: [] }],
        description: "Revokes the refresh token and clears auth cookies.",
        responses: {
          "200": {
            description: "Logged out",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
        },
      },
    },

    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        description:
          "Rotates the refresh token and issues a new access token. Called automatically by the frontend Axios interceptor on 401 responses.",
        responses: {
          "200": {
            description: "New tokens set in cookies",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "401": {
            description: "Refresh token missing, expired, or revoked",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current company profile",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Company profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        company: { $ref: "#/components/schemas/Company" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },

    "/auth/profile": {
      patch: {
        tags: ["Auth"],
        summary: "Update company profile",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  website: { type: "string", format: "uri" },
                  industry: { type: "string" },
                  size: {
                    type: "string",
                    enum: ["1-10", "11-50", "51-200", "201-500", "500+"],
                  },
                  location: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Profile updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                    data: {
                      type: "object",
                      properties: {
                        company: { $ref: "#/components/schemas/Company" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "No valid fields provided" },
        },
      },
    },

    "/auth/profile/logo": {
      post: {
        tags: ["Auth"],
        summary: "Upload company logo",
        security: [{ cookieAuth: [] }],
        description:
          "Accepts multipart/form-data. JPEG, PNG, or WebP only. Max 5 MB.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["logo"],
                properties: {
                  logo: {
                    type: "string",
                    format: "binary",
                    description: "Image file (JPEG / PNG / WebP, ≤ 5 MB)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Logo uploaded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        logoUrl: { type: "string", format: "uri" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid file type or size" },
        },
      },
    },

    "/auth/stats": {
      get: {
        tags: ["Auth"],
        summary: "Dashboard overview stats",
        security: [{ cookieAuth: [] }],
        description:
          "Returns job counts by status, application counts by stage, total candidates, and the 5 most recent jobs — all in a single round-trip.",
        responses: {
          "200": {
            description: "Dashboard stats",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        jobs: {
                          type: "object",
                          properties: {
                            total: { type: "integer" },
                            active: { type: "integer" },
                            draft: { type: "integer" },
                            closed: { type: "integer" },
                          },
                        },
                        applications: {
                          type: "object",
                          properties: {
                            total: { type: "integer" },
                            pendingScoring: { type: "integer" },
                            shortlisted: { type: "integer" },
                            interviewed: { type: "integer" },
                            offered: { type: "integer" },
                            byStage: {
                              type: "object",
                              additionalProperties: { type: "integer" },
                            },
                          },
                        },
                        candidates: {
                          type: "object",
                          properties: { total: { type: "integer" } },
                        },
                        recentJobs: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Job" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/auth/account": {
      delete: {
        tags: ["Auth"],
        summary: "Delete account (NDPR)",
        security: [{ cookieAuth: [] }],
        description:
          "Permanently deletes the company account and all associated data (jobs, applications, stage history, subscription, refresh tokens). Requires password confirmation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password"],
                properties: {
                  password: {
                    type: "string",
                    description: "Current account password for confirmation",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Account and all data deleted. Auth cookies cleared.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "401": { description: "Incorrect password" },
        },
      },
    },

    // ── Jobs ────────────────────────────────────────────
    "/jobs/public": {
      get: {
        tags: ["Jobs — Public"],
        summary: "List active jobs (public job board)",
        description:
          "No authentication required. Paginated, searchable, filterable by type.",
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
          {
            name: "search",
            in: "query",
            schema: { type: "string" },
            description: "Full-text search on title and description",
          },
          {
            name: "type",
            in: "query",
            schema: {
              type: "string",
              enum: ["full-time", "part-time", "contract", "remote", "hybrid"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of active jobs",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/PublicJob" },
                    },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/jobs/public/{id}": {
      get: {
        tags: ["Jobs — Public"],
        summary: "Get a single active job (public)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Job detail with company info",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { $ref: "#/components/schemas/PublicJob" },
                  },
                },
              },
            },
          },
          "404": { description: "Job not found or not active" },
        },
      },
    },

    "/jobs": {
      get: {
        tags: ["Jobs — Dashboard"],
        summary: "List company jobs",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["draft", "active", "closed", "archived"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated company jobs",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Job" },
                    },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Jobs — Dashboard"],
        summary: "Create a job",
        security: [{ cookieAuth: [] }],
        description:
          "Requires an active subscription (or within free-tier quota).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/JobInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Job created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                    data: { $ref: "#/components/schemas/Job" },
                  },
                },
              },
            },
          },
          "402": { description: "Subscription required or job limit reached" },
        },
      },
    },

    "/jobs/{id}": {
      get: {
        tags: ["Jobs — Dashboard"],
        summary: "Get a single job",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Job detail",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { $ref: "#/components/schemas/Job" },
                  },
                },
              },
            },
          },
          "404": { description: "Job not found" },
        },
      },
      patch: {
        tags: ["Jobs — Dashboard"],
        summary: "Update a job",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/JobInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Job updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { $ref: "#/components/schemas/Job" },
                  },
                },
              },
            },
          },
          "404": { description: "Job not found" },
        },
      },
      delete: {
        tags: ["Jobs — Dashboard"],
        summary: "Delete a job (soft delete)",
        security: [{ cookieAuth: [] }],
        description:
          "Sets `deletedAt` — the row is retained for audit purposes.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Job deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "404": { description: "Job not found" },
        },
      },
    },

    "/jobs/{id}/status": {
      patch: {
        tags: ["Jobs — Dashboard"],
        summary: "Update job status",
        security: [{ cookieAuth: [] }],
        description: "Publish (active), close, or archive a job.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["draft", "active", "closed", "archived"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Status updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        status: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Job not found" },
        },
      },
    },

    // ── Applications ────────────────────────────────────
    "/applications/{jobId}": {
      post: {
        tags: ["Applications — Public"],
        summary: "Submit an application",
        description:
          "Public endpoint. Accepts multipart/form-data including the candidate's CV (PDF, ≤ 5 MB). Enqueues AI scoring asynchronously.",
        parameters: [
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { $ref: "#/components/schemas/ApplicationInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Application submitted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                    data: {
                      type: "object",
                      properties: {
                        applicationId: { type: "string", format: "uuid" },
                        stage: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "409": { description: "Already applied, or job closed" },
          "422": { description: "Validation failed" },
        },
      },
    },

    "/applications/job/{jobId}": {
      get: {
        tags: ["Applications — Dashboard"],
        summary: "List applications for a job",
        security: [{ cookieAuth: [] }],
        description: "Returns applications sorted by AI score descending.",
        parameters: [
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
          {
            name: "stage",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "applied",
                "screening",
                "shortlisted",
                "interview",
                "offer",
                "rejected",
                "withdrawn",
              ],
            },
          },
        ],
        responses: {
          "200": {
            description:
              "Paginated applications with AI scores and candidate info",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Application" },
                    },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                  },
                },
              },
            },
          },
          "404": { description: "Job not found" },
        },
      },
    },

    "/applications/{id}": {
      get: {
        tags: ["Applications — Dashboard"],
        summary: "Get a single application",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Application with candidate and job details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { $ref: "#/components/schemas/Application" },
                  },
                },
              },
            },
          },
          "404": { description: "Application not found" },
        },
      },
    },

    "/applications/{id}/stage": {
      patch: {
        tags: ["Applications — Dashboard"],
        summary: "Move application to a new stage",
        security: [{ cookieAuth: [] }],
        description:
          "Logs stage history and sends an automated email to the candidate.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateStageInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Stage updated, candidate notified",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        stage: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Already at this stage" },
          "404": { description: "Application not found" },
        },
      },
    },

    "/applications/{id}/notes": {
      patch: {
        tags: ["Applications — Dashboard"],
        summary: "Save recruiter notes",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["notes"],
                properties: {
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Notes saved",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "404": { description: "Application not found" },
        },
      },
    },

    // ── Subscriptions ───────────────────────────────────
    "/subscriptions/plans": {
      get: {
        tags: ["Subscriptions"],
        summary: "List available plans",
        description:
          "Public. Returns starter, growth, and scale plans with pricing and features.",
        responses: {
          "200": {
            description: "Plans list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Plan" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/subscriptions/status": {
      get: {
        tags: ["Subscriptions"],
        summary: "Get subscription status",
        security: [{ cookieAuth: [] }],
        description:
          "Returns current plan, active/inactive status, free-tier quota remaining, and period dates.",
        responses: {
          "200": {
            description: "Subscription status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        status: {
                          type: "string",
                          enum: ["active", "inactive", "cancelled"],
                        },
                        plan: { type: "string" },
                        isActive: { type: "boolean" },
                        freeLimit: { type: "integer" },
                        jobsUsed: { type: "integer" },
                        quotaLeft: { type: "integer", nullable: true },
                        quotaExhausted: { type: "boolean" },
                        currentPeriodStart: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                        currentPeriodEnd: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/subscriptions/initialize": {
      post: {
        tags: ["Subscriptions"],
        summary: "Create a Paystack payment session",
        security: [{ cookieAuth: [] }],
        description:
          "Returns a Paystack `authorizationUrl` to redirect the user to for payment. Uses daily idempotency keys to prevent duplicate charges. If a pending session already exists for the same plan, it is resumed instead of creating a new one.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["plan"],
                properties: {
                  plan: {
                    type: "string",
                    enum: ["starter", "growth", "scale"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Payment session created or resumed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                    data: {
                      type: "object",
                      properties: {
                        authorizationUrl: { type: "string", format: "uri" },
                        reference: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "409": { description: "Already on this plan" },
        },
      },
    },

    "/subscriptions/verify": {
      get: {
        tags: ["Subscriptions"],
        summary: "Verify payment and activate subscription",
        security: [{ cookieAuth: [] }],
        description:
          "Called by the frontend after Paystack redirects back. Verifies the transaction with Paystack and activates the subscription. Acts as a fallback if the webhook is delayed.",
        parameters: [
          {
            name: "reference",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Paystack transaction reference from the callback URL",
          },
        ],
        responses: {
          "200": {
            description: "Subscription activated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        plan: { type: "string" },
                        currentPeriodEnd: {
                          type: "string",
                          format: "date-time",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Payment not completed" },
          "403": { description: "Transaction belongs to a different company" },
        },
      },
    },

    // ── Webhooks ────────────────────────────────────────
    "/webhooks/paystack": {
      post: {
        tags: ["Webhooks"],
        summary: "Paystack webhook receiver",
        description:
          "Receives events from Paystack (charge.success, subscription.disable, etc.). Validates the `x-paystack-signature` HMAC-SHA512 header. **Do not call this manually** — it is Paystack's endpoint.",
        parameters: [
          {
            name: "x-paystack-signature",
            in: "header",
            required: true,
            schema: { type: "string" },
            description:
              "HMAC-SHA512 of the raw request body, signed with PAYSTACK_WEBHOOK_SECRET",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  event: { type: "string", example: "charge.success" },
                  data: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Event acknowledged" },
          "400": { description: "Invalid signature" },
        },
      },
    },
  },

  // ─── Tag order in UI ───────────────────────────────────
  tags: [
    { name: "Health", description: "Service health check" },
    {
      name: "Auth",
      description: "Company registration, login, profile management",
    },
    {
      name: "Jobs — Public",
      description: "Public job board endpoints (no auth)",
    },
    {
      name: "Jobs — Dashboard",
      description: "Job management for authenticated companies",
    },
    {
      name: "Applications — Public",
      description: "Candidate-facing application submission (no auth)",
    },
    {
      name: "Applications — Dashboard",
      description: "Application review, pipeline, and notes (auth required)",
    },
    {
      name: "Subscriptions",
      description: "Plans, billing, and Paystack payment flow",
    },
    { name: "Webhooks", description: "Paystack event receiver" },
  ],
} as const;
