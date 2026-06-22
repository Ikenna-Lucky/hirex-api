import app from "./app";

const PORT = Number(process.env.PORT) || 3001;

const server = Bun.serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`🚀 HireX API running on http://localhost:${PORT}`);

// Graceful shutdown — let in-flight requests finish before exiting
function shutdown(signal: string) {
  console.log(`[API] ${signal} received — shutting down gracefully...`);
  server.stop();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
