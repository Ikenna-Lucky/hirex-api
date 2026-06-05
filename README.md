# hirex-api

> The core REST API for the HireX AI Recruitment Platform — built with Hono, Bun, Drizzle ORM, and PostgreSQL.

---

## Overview

`hirex-api` is the backend server that powers all business logic for HireX. It handles company authentication, job management, candidate applications, AI scoring orchestration, subscription billing via Paystack, and automated candidate email notifications.

Every request from the frontend passes through this server. It is the single source of truth for data, authorization, and business rules.

---

## Tech Stack

| Layer        | Technology                                                                           | Purpose                                         |
| ------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Runtime      | [Bun](https://bun.sh)                                                                | Fast JavaScript runtime and package manager     |
| Framework    | [Hono](https://hono.dev)                                                             | Lightweight, TypeScript-first web framework     |
| Database     | [PostgreSQL 16](https://www.postgresql.org)                                          | Primary relational data store                   |
| ORM          | [Drizzle ORM](https://orm.drizzle.team)                                              | Type-safe query builder and schema manager      |
| DB Driver    | [@neondatabase/serverless](https://neon.tech)                                        | Postgres driver (works with Neon in production) |
| Validation   | [Zod](https://zod.dev) + [@hono/zod-validator](https://github.com/honojs/middleware) | Request body validation                         |
| Auth         | [jose](https://github.com/panva/jose)                                                | JWT signing and verification                    |
| Passwords    | [Argon2](https://github.com/ranisalt/node-argon2)                                    | Secure password hashing                         |
| File Storage | [Cloudinary](https://cloudinary.com)                                                 | CV uploads and company logo storage             |
| Job Queue    | [BullMQ](https://bullmq.io) + [ioredis](https://github.com/redis/ioredis)            | Enqueues CV scoring jobs for the AI worker      |
| Email        | [Nodemailer](https://nodemailer.com)                                                 | Transactional emails to candidates              |
| Payments     | [Paystack](https://paystack.com) (via Axios)                                         | Subscription billing and webhook handling       |

---

## Project Structure

```
hirex-api/
├── src/
│   ├── index.ts                        # Entry point — starts the Bun server
│   ├── app.ts                          # Hono app, middleware, route registration
│   ├── db/
│   │   ├── index.ts                    # Database connection (Drizzle + Neon)
│   │   └── schema.ts                   # All table and enum definitions
│   ├── middleware/
│   │   ├── auth.ts                     # requireAuth — JWT verification
│   │   └── requireSubscription.ts      # Billing gate for job creation
│   ├── routes/
│   │   ├── auth.ts                     # Register, login, profile, stats, logo
│   │   ├── jobs.ts                     # Job CRUD + public job board
│   │   ├── applications.ts             # Application submission + pipeline management
│   │   ├── candidates.ts               # Candidate lookup and listing
│   │   ├── subscriptions.ts            # Plan management and Paystack integration
│   │   └── webhooks.ts                 # Paystack webhook event handlers
│   ├── lib/
│   │   ├── config.ts                   # Centralised environment variable config
│   │   ├── jwt.ts                      # signToken / verifyToken helpers
│   │   ├── cloudinary.ts               # uploadCV / uploadLogo helpers
│   │   ├── email.ts                    # sendStageEmail helper
│   │   ├── queue.ts                    # enqueueCvScoring — pushes jobs to BullMQ
│   │   ├── paystack.ts                 # Paystack API client (initialize, verify)
│   │   ├── emails/
│   │   │   └── templates.ts            # HTML email templates per hiring stage
│   │   └── validators/
│   │       ├── auth.validators.ts      # Zod schemas for register/login
│   │       ├── job.validators.ts       # Zod schemas for job creation/update
│   │       └── application.validators.ts # Zod schemas for application submission
│   └── types/
│       └── index.ts                    # Shared TypeScript types (JwtPayload, etc.)
├── drizzle.config.ts                   # Drizzle Kit configuration
├── Dockerfile                          # Multi-stage production Docker build
├── package.json
└── tsconfig.json
```

---

## Database Schema

### Tables

| Table           | Description                                                          |
| --------------- | -------------------------------------------------------------------- |
| `companies`     | Recruiter accounts — one company per account                         |
| `subscriptions` | One-to-one with companies — tracks plan, status, billing dates       |
| `jobs`          | Job postings created by companies                                    |
| `candidates`    | People who apply — identified uniquely by email                      |
| `applications`  | Junction between a candidate and a job — holds CV URL and AI results |
| `stage_history` | Audit log of every pipeline stage change                             |

### Enums

| Enum                  | Values                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `job_status`          | `draft` · `active` · `closed` · `archived`                                                 |
| `application_stage`   | `applied` · `screening` · `shortlisted` · `interview` · `offer` · `rejected` · `withdrawn` |
| `scoring_status`      | `pending` · `processing` · `completed` · `failed`                                          |
| `subscription_status` | `active` · `inactive` · `trialing` · `cancelled`                                           |

---

## API Reference

All routes are prefixed with `/api`. Protected routes require an `Authorization: Bearer <token>` header.

### Authentication — `/api/auth`

| Method  | Path                 | Auth | Description                                        |
| ------- | -------------------- | ---- | -------------------------------------------------- |
| `POST`  | `/auth/register`     | ❌   | Create a new company account                       |
| `POST`  | `/auth/login`        | ❌   | Login and receive a JWT                            |
| `GET`   | `/auth/me`           | ✅   | Get current company profile                        |
| `PATCH` | `/auth/profile`      | ✅   | Update company profile fields                      |
| `POST`  | `/auth/profile/logo` | ✅   | Upload company logo (`multipart/form-data`)        |
| `GET`   | `/auth/stats`        | ✅   | Dashboard overview stats (all queries in parallel) |
| `POST`  | `/auth/logout`       | ✅   | Stateless logout (client drops the token)          |

### Jobs — `/api/jobs`

| Method   | Path               | Auth              | Description                                      |
| -------- | ------------------ | ----------------- | ------------------------------------------------ |
| `GET`    | `/jobs/public`     | ❌                | Public job board with search, filter, pagination |
| `GET`    | `/jobs/public/:id` | ❌                | Single job detail for candidates                 |
| `GET`    | `/jobs`            | ✅                | List company's own jobs                          |
| `POST`   | `/jobs`            | ✅ + subscription | Create a new job posting                         |
| `GET`    | `/jobs/:id`        | ✅                | Get a single job                                 |
| `PATCH`  | `/jobs/:id`        | ✅                | Update job details                               |
| `PATCH`  | `/jobs/:id/status` | ✅                | Change job status (publish / close / archive)    |
| `DELETE` | `/jobs/:id`        | ✅                | Delete a job (blocked if it has applications)    |

### Applications — `/api/applications`

| Method  | Path                       | Auth | Description                                                   |
| ------- | -------------------------- | ---- | ------------------------------------------------------------- |
| `POST`  | `/applications/:jobId`     | ❌   | Candidate submits application with CV (`multipart/form-data`) |
| `GET`   | `/applications/job/:jobId` | ✅   | List all applications for a job (filterable by stage)         |
| `GET`   | `/applications/:id`        | ✅   | Get a single application with full candidate + AI data        |
| `PATCH` | `/applications/:id/stage`  | ✅   | Move candidate to a new hiring stage                          |
| `PATCH` | `/applications/:id/notes`  | ✅   | Save internal recruiter notes                                 |

### Subscriptions — `/api/subscriptions`

| Method | Path                        | Auth | Description                              |
| ------ | --------------------------- | ---- | ---------------------------------------- |
| `GET`  | `/subscriptions/plans`      | ❌   | List all available plans and pricing     |
| `GET`  | `/subscriptions/status`     | ✅   | Get current subscription state and quota |
| `POST` | `/subscriptions/initialize` | ✅   | Create a Paystack payment session        |
| `GET`  | `/subscriptions/verify`     | ✅   | Confirm payment after Paystack redirect  |

### Webhooks — `/api/webhooks`

| Method | Path                 | Auth | Description                            |
| ------ | -------------------- | ---- | -------------------------------------- |
| `POST` | `/webhooks/paystack` | HMAC | Receives and processes Paystack events |

**Paystack events handled:**

| Event                    | Action                                  |
| ------------------------ | --------------------------------------- |
| `charge.success`         | Activate subscription                   |
| `subscription.create`    | Store subscription code, confirm period |
| `subscription.disable`   | Mark subscription cancelled             |
| `invoice.payment_failed` | Mark subscription inactive              |
| `invoice.update`         | Extend current period end date          |

### Health Check

```
GET /api/health
→ { "status": "ok", "service": "HireX API", "timestamp": "..." }
```

---

## Middleware

### `requireAuth`

Reads the `Authorization: Bearer <token>` header, verifies the JWT signature and expiry, and attaches the decoded payload to the Hono context as `c.get("company")`. All downstream route handlers use `c.get("company").sub` to get the company's ID.

Returns `401` if the token is missing, malformed, or expired.

### `requireSubscription`

Runs after `requireAuth` on `POST /api/jobs`. Enforces the free-tier quota:

- **0 jobs posted** → free first post allowed
- **1+ jobs posted, no active subscription** → `403 FREE_QUOTA_EXHAUSTED`
- **Active subscription** → unlimited job creation

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- PostgreSQL running (via Docker: `cd ../hirex-infra && make up`)
- Redis running (included in the above)

### Local Setup

```bash
# Install dependencies
bun install

# Copy env template
cp .env.example .env
# Fill in all values in .env

# Apply database schema
bun run db:push

# Start in dev mode (hot reload)
bun run dev
```

The API will be available at `http://localhost:3001`.

---

## Environment Variables

| Variable                  | Required | Description                                     |
| ------------------------- | -------- | ----------------------------------------------- |
| `DATABASE_URL`            | ✅       | PostgreSQL connection string                    |
| `REDIS_URL`               | ✅       | Redis connection string                         |
| `JWT_SECRET`              | ✅       | Secret for signing JWTs — minimum 32 characters |
| `CLOUDINARY_CLOUD_NAME`   | ✅       | Cloudinary cloud name                           |
| `CLOUDINARY_API_KEY`      | ✅       | Cloudinary API key                              |
| `CLOUDINARY_API_SECRET`   | ✅       | Cloudinary API secret                           |
| `SMTP_HOST`               | ✅       | SMTP server hostname (e.g. `smtp.gmail.com`)    |
| `SMTP_PORT`               | ✅       | SMTP port (e.g. `587`)                          |
| `SMTP_USER`               | ✅       | SMTP username / Gmail address                   |
| `SMTP_PASS`               | ✅       | SMTP password / Gmail App Password              |
| `EMAIL_FROM`              | ✅       | From address shown on emails                    |
| `PAYSTACK_SECRET_KEY`     | ✅       | Paystack secret key                             |
| `PAYSTACK_WEBHOOK_SECRET` | ✅       | Webhook signature verification secret           |
| `FRONTEND_URL`            | ✅       | Frontend origin for CORS and email links        |
| `PORT`                    | ❌       | Server port (default: `3001`)                   |
| `NODE_ENV`                | ❌       | `development` or `production`                   |

---

## Available Scripts

```bash
bun run dev          # Start with hot reload (bun --hot)
bun run start        # Start in production mode

bun run db:push      # Apply schema changes directly to the database (dev)
bun run db:generate  # Generate SQL migration files from schema changes
bun run db:migrate   # Apply generated SQL migration files (production)
bun run db:studio    # Open Drizzle Studio (visual database browser)
```

---

## Application Submission Flow

When a candidate submits a job application, the following happens in a single request:

```
1. Validate form fields (Zod)
2. Validate CV file (PDF only, ≤ 5 MB)
3. Verify job is active and not past closing date
4. Upsert candidate by email (find existing or create new)
5. Block duplicate applications (same candidate + job)
6. Upload CV PDF to Cloudinary
7. Create application row in database (scoringStatus = "pending")
8. Increment job application count
9. Enqueue CV scoring job in BullMQ (Redis)
10. Send confirmation email to candidate (fire and forget)
11. Respond 201 to the candidate immediately
```

The AI scoring (step 9) runs asynchronously in `hirex-ai-worker` — the candidate never waits for it.

---

## Docker

The API ships with a multi-stage Dockerfile optimised for production:

```dockerfile
# Stage 1: Install production dependencies only
FROM oven/bun:1.1-alpine AS deps

# Stage 2: Copy deps + source, run the server
FROM oven/bun:1.1-alpine AS runner
```

```bash
# Build the image manually
docker build -t hirex-api .

# Or use the infra orchestration (recommended)
cd ../hirex-infra && make up
```

---

## Related Repositories

| Repository                              | Description                                             |
| --------------------------------------- | ------------------------------------------------------- |
| [`hirex-infra`](../hirex-infra)         | Docker Compose orchestration and developer tooling      |
| [`hirex-ai-worker`](../hirex-ai-worker) | BullMQ worker — consumes CV scoring jobs from the queue |
| [`hirex-frontend`](../hirex-frontend)   | Next.js 14 recruiter dashboard and public job board     |
