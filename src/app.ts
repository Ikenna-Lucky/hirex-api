import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { openApiSpec } from "./docs/openapi";

import authRoutes from "./routes/auth";
import jobRoutes from "./routes/jobs";
import applicationRoutes from "./routes/applications";
import candidateRoutes from "./routes/candidates";
import subscriptionRoutes from "./routes/subscriptions";
import webhookRoutes from "./routes/webhooks";
import { authLimiter, publicLimiter, apiLimiter } from "./middleware/rateLimit";
import { Sentry } from "./lib/sentry";

const app = new Hono().basePath("/api");

// ─── Global Middleware ─────────────────────────────────
app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Block requests with bodies larger than 1MB
app.use("*", async (c, next) => {
  const contentLength = c.req.header("content-length");
  if (contentLength && Number(contentLength) > 1_000_000) {
    return c.json({ success: false, message: "Request body too large" }, 413);
  }
  await next();
});

// ─── API Docs ─────────────────────────────────────────
// Raw OpenAPI JSON spec
app.get("/docs/spec.json", (c) => c.json(openApiSpec));

// Swagger UI — served via CDN, no extra package needed
app.get("/docs", (c) =>
  c.html(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HireX API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        SwaggerUIBundle({
          url: "/api/docs/spec.json",
          dom_id: "#swagger-ui",
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
          layout: "BaseLayout",
          deepLinking: true,
        });
      };
    </script>
  </body>
</html>`),
);

// ─── Health Check ──────────────────────────────────────
app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "HireX API",
    timestamp: new Date().toISOString(),
  }),
);

// ─── Routes ───────────────────────────────────────────
app.use("/auth/*", authLimiter);
app.use("/jobs/public/*", publicLimiter);
app.use("/applications/*", publicLimiter);
app.use("*", apiLimiter);

app.route("/auth", authRoutes);
app.route("/jobs", jobRoutes);
app.route("/applications", applicationRoutes);
app.route("/candidates", candidateRoutes);
app.route("/subscriptions", subscriptionRoutes);
app.route("/webhooks", webhookRoutes);

// ─── 404 Handler ──────────────────────────────────────
app.notFound((c) =>
  c.json({ success: false, message: "Route not found" }, 404),
);

// ─── Error Handler ────────────────────────────────────
app.onError((err, c) => {
  console.error(`[HireX API Error] ${err.message}`, err.stack);
  Sentry.captureException(err);
  return c.json({ success: false, message: "Internal server error" }, 500);
});

export default app;
