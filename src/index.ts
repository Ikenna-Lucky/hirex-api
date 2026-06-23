// Sentry must be initialised before anything else so it can instrument all modules
import { initSentry } from "./lib/sentry";
initSentry();

import app from "./app";
import { runMigrations } from "./db/migrate";

const PORT = Number(process.env.PORT) || 3001;

// Run pending migrations before accepting traffic.
// Safe to call on every startup — already-applied migrations are skipped.
await runMigrations();

const server = Bun.serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`🚀 HireX API running on http://localhost:${PORT}`);

// Graceful shutdown — let in-flight requests finish before exiting
function shutdown(signal: string) {
  console.log