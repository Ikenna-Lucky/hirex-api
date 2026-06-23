import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, count } from "drizzle-orm";
import { db } from "../db";
import { subscriptions, companies, jobs } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import {
  PLANS,
  initializeTransaction,
  verifyTransaction,
  type PlanKey,
} from "../lib/paystack";

const subscriptionRoutes = new Hono();

// ─── GET /api/subscriptions/plans ─────────────────────
// Public — returns all available plans for the pricing page
subscriptionRoutes.get("/plans", (c) => {
  const plans = Object.values(PLANS).map(
    ({ key, name, priceNGN, jobLimit, tagline, features }) => ({
      key,
      name,
      priceNGN,
      jobLimit,
      tagline,
      features,
    }),
  );

  return c.json({ success: true, data: plans });
});

// ─── All routes below require auth ────────────────────
subscriptionRoutes.use("*", requireAuth);

// ─── GET /api/subscriptions/status ────────────────────
subscriptionRoutes.get("/status", async (c) => {
  const { sub } = c.get("company");

  const [[subscription], [{ jobsUsed }]] = await Promise.all([
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, sub))
      .limit(1),

    db.select({ jobsUsed: count() }).from(jobs).where(eq(jobs.companyId, sub)),
  ]);

  if (!subscription) {
    return c.json({ success: false, message: "No subscription found" }, 404);
  }

  const plan = PLANS[subscription.plan as PlanKey] ?? null;
  const isActive = subscription.status === "active";
  const FREE_LIMIT = 1;

  return c.json({
    success: true,
    data: {
      status: subscription.status,
      plan: subscription.plan,
      isActive,

      // Free-tier quota info (always present so the UI can render usage)
      freeLimit: FREE_LIMIT,
      jobsUsed: Number(jobsUsed),
      quotaLeft: isActive ? null : Math.max(0, FREE_LIMIT - Number(jobsUsed)),
      quotaExhausted: !isActive && Number(jobsUsed) >= FREE_LIMIT,

      planDetails: plan
        ? {
            name: plan.name,
            priceNGN: plan.priceNGN,
            jobLimit: plan.jobLimit,
            features: plan.features,
          }
        : null,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  });
});

// ─── POST /api/subscriptions/initialize ───────────────
subscriptionRoutes.post(
  "/initialize",
  zValidator(
    "json",
    z.object({ plan: z.enum(["starter", "growth", "scale"]) }),
  ),
  async (c) => {
    const { sub, email } = c.get("company");
    const { plan } = c.req.valid("json");

    const [existing] = await db
      .select({
        status: subscriptions.status,
        plan: subscriptions.plan,
        pendingReference: subscriptions.pendingReference,
      })
      .from(subscriptions)
      .where(eq(subscriptions.companyId, sub))
      .limit(1);

    // Already active on this plan — nothing to do
    if (existing?.status === "active" && existing.plan === plan) {
      return c.json(
        { success: false, message: `You are already on the ${plan} plan` },
        409,
      );
    }

    // If there is already a pending (incomplete) checkout session for the same
    // plan, verify its status with Paystack before creating a new one.
    // This handles double-clicks and browser back-button retries.
    if (existing?.pendingReference) {
      try {
        const tx = await verifyTransaction(existing.pendingReference);
        if (tx.status !== "success" && tx.plan === plan) {
          // Transaction still open — reuse the existing authorization URL
          const reInit = await initializeTransaction(
            email,
            plan as PlanKey,
            sub,
            // Same idempotency key → Paystack returns the same session
            `hirex-init-${sub}-${plan}-${existing.pendingReference}`,
          );
          return c.json({
            success: true,
            message: "Resuming existing payment session",
            data: {
              authorizationUrl: reInit.authorizationUrl,
              reference: existing.pendingReference,
            },
          });
        }
      } catch {
        // Verification failed — old reference is stale; fall through to create a new one
      }
    }

    // Generate a daily idempotency key: same company + plan on the same UTC day
    // returns the same Paystack transaction, preventing duplicate charges from retries.
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const idempotencyKey = `hirex-init-${sub}-${plan}-${today}`;

    const result = await initializeTransaction(
      email,
      plan as PlanKey,
      sub,
      idempotencyKey,
    );

    // Persist the reference so we can detect and resume duplicate requests
    await db
      .update(subscriptions)
      .set({ pendingReference: result.reference, updatedAt: new Date() })
      .where(eq(subscriptions.companyId, sub));

    return c.json({
      success: true,
      message: "Payment session created",
      data: {
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
      },
    });
  },
);

// ─── GET /api/subscriptions/verify ────────────────────
// Called by the frontend after Paystack redirects back
// Acts as a fallback if webhook is delayed
subscriptionRoutes.get("/verify", async (c) => {
  const reference = c.req.query("reference");
  const { sub } = c.get("company");

  if (!reference) {
    return c.json(
      { success: false, message: "reference query param is required" },
      400,
    );
  }

  const tx = await verifyTransaction(reference);

  if (tx.status !== "success") {
    return c.json(
      { success: false, message: "Payment was not completed successfully" },
      400,
    );
  }

  // Guard: make sure this transaction belongs to this company
  if (tx.companyId !== sub) {
    return c.json({ success: false, message: "Transaction mismatch" }, 403);
  }

  // Activate subscription and clear the pending reference
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  await db
    .update(subscriptions)
    .set({
      status: "active",
      plan: tx.plan,
      paystackCustomerCode: tx.customerCode,
      pendingReference: null, // payment is done — clear the idempotency guard
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      updatedAt: now,
    })
    .where(eq(subscriptions.companyId, sub));

  return c.json({
    success: true,
    message: "Subscription activated",
    data: {
      plan: tx.plan,
      currentPeriodEnd: periodEnd,
    },
  });
});

export default subscriptionRoutes;
