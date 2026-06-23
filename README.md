# HireX API

> REST API powering the HireX AI recruitment platform — handles auth, jobs, applications, AI scoring orchestration, and subscription billing.

![CI](https://github.com/YOUR_USERNAME/hirex-api/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## What It Does

`hirex-api` is the single backend for HireX. Every request from the recruiter dashboard and the public job board passes through here. It manages company accounts, job postings, candidate applications, subscription billing via Paystack, and enqueues CV scoring jobs for the AI worker to pick up asynchronously.

---

## Tech Stack

`Bun` · `Hono` · `TypeScript` · `PostgreSQL` · `Drizzle ORM` · `BullMQ` · `Redis` · `Cloudinary` · `Resend` · `Paystack` · `Sentry`

---

## Architecture

```
Recruiter Dashboard / Public Job Board (Next.js)
            ↓ HTTP
      hirex-api  (Hono / Bun)
     ↙         ↘
Neon DB      BullMQ (Redis)
               ↓
         hirex-ai-worker
               ↓
            Neon DB  ← results written back
```

---

## Key Features

- **JWT auth with httpOnly cookies** — access tokens (15 min) + refresh tokens (30 days), never exposed to JavaScript
- **Account lockout** — 5 failed login attempts locks the account for 15 minutes
- **AI-powered CV scoring** — applications enqueued to BullMQ; scored by Gemini asynchronously
- **7-stage hiring pipeline** — with full audit log and automated candidate email notifications per stage
- **Subscription billing** — Paystack integration with idempotency keys to prevent double-charges
- **Soft deletes** — jobs and applications are flagged `deleted_at`, never hard deleted
- **NDPR compliance** — account deletion endpoint cascades all user data
- **DB migrations on startup** — pending Drizzle migrations apply automatically before the server accepts traffic

---

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- PostgreSQL (via Docker: `cd ../hirex-infra && make up`)
- Redis (included above)

---

## Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/hirex-api
cd hirex-api
bun install
cp .env.example .env        # fill in all values
bun run db:generate         # generate baseline migration
bun run db:baseline         # mark baseline as applied (existing DB only)
bun run dev
```

API runs at `http://localhost:3001`.

---

## Environment Variables

See `.env.example` for the full template. Never commit real values.

| Variable                  | Required | Description                                     |
| ------------------------- | -------- | ----------------------------------------------- |
| `DATABASE_URL`            | ✅       | PostgreSQL connection string                    |
| `REDIS_URL`               | ✅       | Redis connection string                         |
| `JWT_SECRET`              | ✅       | Secret for signing JWTs — minimum 32 characters |
| `CLOUDINARY_CLOUD_NAME`   | ✅       | Cloudinary cloud name                           |
| `CLOUDINARY_API_KEY`      | ✅       | Cloudinary API key                              |
| `CLOUDINARY_API_SECRET`   | ✅       | Cloudinary API secret                           |
| `RESEND_API_KEY`          | ✅       | Resend API key for transactional emails         |
| `EMAIL_FROM`              | ✅       | From address shown on candidate emails          |
| `PAYSTACK_SECRET_KEY`     | ✅       | Paystack secret key                             |
| `PAYSTACK_WEBHOOK_SECRET` | ✅       | Webhook signature verification secret           |
| `FRONTEND_URL`            | ✅       | Frontend origin for CORS and email links        |
| `SENTRY_DSN`              | ✅       | Sentry DSN for error monitoring                 |
| `PORT`                    | ❌       | Server port (default: `3001`)                   |
| `NODE_ENV`                | ❌       | `development` or `production`                   |

---

## Running Tests

```bash
bun run test
```

Tests use Bun's built-in test runner with mocked DB and Redis — no real connections needed.

---

## Available Scripts

```bash
bun run dev                 # Start with hot reload
bun run start               # Start in production mode
bun run test                # Run the test suite

bun run db:generate         # Generate SQL migration file from schema changes
bun run db:baseline         # Mark baseline as applied (first-time setup on existing DB)
bun run db:migrate          # Apply migrations via drizzle-kit CLI
bun run db:migrate:deploy   # Programmatic runner — called automatically on startup
bun run db:push             # Push schema directly to DB (dev only)
bun run db:studio           # Open Drizzle Studio (visual DB browser)
```

---

## API Endpoints

All routes are prefixed `/api`. Protected routes require auth cookies (set on login).

| Method   | Path                        | Auth | Description                               |
| -------- | --------------------------- | ---- | ----------------------------------------- |
| `POST`   | `/auth/register`            | ❌   | Create company account                    |
| `POST`   | `/auth/login`               | ❌   | Login — sets httpOnly auth cookies        |
| `GET`    | `/auth/me`                  | ✅   | Current company profile                   |
| `DELETE` | `/auth/account`             | ✅   | Permanently delete account + all data     |
| `GET`    | `/jobs/public`              | ❌   | Public job board                          |
| `POST`   | `/jobs`                     | ✅   | Create job (requires active subscription) |
| `DELETE` | `/jobs/:id`                 | ✅   | Soft delete job                           |
| `POST`   | `/applications/:jobId`      | ❌   | Candidate submits application + CV        |
| `PATCH`  | `/applications/:id/stage`   | ✅   | Move candidate to new hiring stage        |
| `GET`    | `/subscriptions/plans`      | ❌   | List plans and pricing                    |
| `POST`   | `/subscriptions/initialize` | ✅   | Create Paystack payment session           |
| `POST`   | `/webhooks/paystack`        | HMAC | Receive Paystack events                   |
| `GET`    | `/health`                   | ❌   | Health check (used by UptimeRobot)        |

---

## Deployment

Deployed to [Render](https://render.com) via GitHub Actions. On every push to `main`:

1. CI runs the test suite
2. CI checks that any `schema.ts` changes include a migration file
3. On pass, Render is triggered to deploy
4. On startup, pending migrations are applied automatically before traffic is accepted

See `.github/workflows/ci.yml` for the full pipeline.

---

## Project Structure

```
src/
├── index.ts                # Entry point — runs migrations, starts server
├── app.ts                  # Hono app, middleware, route registration
├── db/
│   ├── index.ts            # Drizzle + postgres.js connection
│   ├── schema.ts           # All table and enum definitions
│   ├── migrate.ts          # Programmatic migration runner
│   └── baseline.ts         # One-time baseline setup script
├── middleware/
│   ├── auth.ts             # requireAuth — JWT cookie verification
│   └── requireSubscription.ts  # Billing gate for job creation
├── routes/
│   ├── auth.ts             # Auth + account management
│   ├── jobs.ts             # Job CRUD + public board
│   ├── applications.ts     # Application submission + pipeline
│   ├── candidates.ts       # Candidate lookup
│   ├── subscriptions.ts    # Plans + Paystack
│   └── webhooks.ts         # Paystack webhook handlers
└── lib/
    ├── config.ts           # Centralised env config
    ├── jwt.ts              # Token signing/verification
    ├── cloudinary.ts       # File upload helpers
    ├── email.ts            # Stage email sender
    ├── queue.ts            # BullMQ enqueue helper
    ├── paystack.ts         # Paystack API client
    ├── sentry.ts           # Sentry initialisation
    └── validators/         # Zod schemas per route
```

---

## Related Repositories

| Repository                              | Description                                      |
| --------------------------------------- | ------------------------------------------------ |
| [`hirex-frontend`](../hirex-frontend)   | Next.js recruiter dashboard and public job board |
| [`hirex-ai-worker`](../hirex-ai-worker) | BullMQ worker — CV scoring via Gemini            |
| [`hirex-infra`](../hirex-infra)         | Docker Compose orchestration for local dev       |

---

## License

MIT — see `LICENSE` for details.
