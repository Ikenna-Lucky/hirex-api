import app from "./app";

const PORT = Number(process.env.PORT) || 3001;

Bun.serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`🚀 HireX API running on http://localhost:${PORT}`);
