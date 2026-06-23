import * as Sentry from "@sentry/node";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;

  // Only initialise when a DSN is present — skip silently in test/local envs without it
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    // Capture 10% of requests for performance tracing — enough signal without burning quota
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
