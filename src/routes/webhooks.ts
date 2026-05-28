import { Hono } from "hono";
import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { subscriptions } from "../db/schema";
import { config } from "../lib/config";
import { verifyTransaction } from "../lib/paystack";

const webhookRoutes = new Hono();

// In-memory idempotency set — prevents double-processing if Paystack retries
// within the same process lifetime. For multi-instance deployments, swap this
// for a Redis SET with a short TTL (e.g. 24 h).
const processedRefs = new Set<string>();

// ─── POST /api/webhooks/paystack ───────────────────────
webhookRoutes.post("/paystack", async (c) => {
  // 1. Read the raw body for HMAC verification — must happen before any parsing
  const rawBody = await c.req.text();
  const signature = c.req.header("x-paystack-signature") ?? "";

  // 2. Verify the request genuinely came from Paystack
  const expectedSignature = createHmac("sha512", config.paystack.secretKey)
    .update(rawBody)
    .digest("hex");

  if (signature !== expectedSignature) {
    console.warn("[Webhook] Invalid Paystack signature — request rejected");
    return c.json({ message: "Invalid signature" }, 401);
  }

  // 3. Parse event
  let event: { event: string; data: Record<string, unknown> };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ message: "Invalid JSON payload" }, 400);
  }

  const { event: eventType, data } = event;

  console.log(`[Webhook] Paystack event received: ${eventType}`);

  // 4. Handle events — always respond 200 first, then process async
  //    (Paystack retries if it doesn't get 200 within a few seconds)
  switch (eventType) {
    case "charge.success": {
      await handleChargeSuccess(data);
      break;
    }

    // subscription.create fires when Paystack creates a recurring subscription.
    // It is the canonical signal for subscription activation — more reliable than
    // charge.success for recurring plans because it carries the subscription code.
    case "subscription.create": {
      await handleSubscriptionCreate(data);
      break;
    }

    case "subscription.disable": {
      await handleSubscriptionDisable(data);
      break;
    }

    case "invoice.payment_failed": {
      await handlePaymentFailed(data);
      break;
    }

    // invoice.update fires on successful recurring charges — keep subscription
    // period end date current so quota checks stay accurate.
    case "invoice.update": {
      await handleInvoiceUpdate(data);
      break;
    }

    default:
      // Acknowledge unhandled events silently
      break;
  }

  // Paystack expects a 200 — never leave it hanging
  return c.json({ received: true });
});

// ─── Event Handlers ───────────────────────────────────

/**
 * charge.success — fired on every successful charge (one-off or recurring).
 * We use this to activate subscriptions initiated via our /verify flow, where
 * the companyId is embedded in the transaction metadata.
 */
async function handleChargeSuccess(data: Record<string, unknown>) {
  try {
    const reference = data.reference as string;

    // Idempotency: skip if we already processed this reference
    if (processedRefs.has(reference)) {
      console.log(
        `[Webhook] charge.success duplicate skipped — ref: ${reference}`,
      );
      return;
    }

    const tx = await verifyTransaction(reference);

    // Guard: companyId must be present and non-empty in the metadata
    if (tx.status !== "success") {
      console.warn(
        `[Webhook] charge.success skipped — tx status: ${tx.status}`,
      );
      return;
    }

    if (!tx.companyId || tx.companyId.trim() === "") {
      console.warn(
        `[Webhook] charge.success skipped — missing companyId in metadata (ref: ${reference}). ` +
          "This may be a direct Paystack charge not initiated through HireX.",
      );
      return;
    }

    // Mark as processed before the DB write to prevent races on retry
    processedRefs.add(reference);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    await db
      .update(subscriptions)
      .set({
        status: "active",
        plan: tx.plan,
        paystackCustomerCode: tx.customerCode,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        updatedAt: now,
      })
      .where(eq(subscriptions.companyId, tx.companyId));

    console.log(
      `[Webhook] Subscription activated via charge.success — company: ${tx.companyId}, plan: ${tx.plan}`,
    );
  } catch (err) {
    console.error("[Webhook] Failed to handle charge.success:", err);
  }
}

/**
 * subscription.create — Paystack fires this when a recurring subscription is
 * created. Unlike charge.success, this event carries the subscription_code
 * which we store for future management (pause/cancel via API).
 */
async function handleSubscriptionCreate(data: Record<string, unknown>) {
  try {
    const customerCode = (data.customer as Record<string, unknown>)
      ?.customer_code as string;
    const subscriptionCode = data.subscription_code as string | undefined;
    const planObj = data.plan as Record<string, unknown> | undefined;
    const planInterval = planObj?.interval as string | undefined; // monthly, annually, etc.

    if (!customerCode) {
      console.warn("[Webhook] subscription.create — no customer code found");
      return;
    }

    // We may not have the subscription code yet from charge.success — store it now
    const now = new Date();
    const periodEnd = new Date(now);
    // Default to 30 days; adjust based on plan interval if available
    const days = planInterval === "annually" ? 365 : 30;
    periodEnd.setDate(periodEnd.getDate() + days);

    await db
      .update(subscriptions)
      .set({
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        ...(subscriptionCode
          ? { paystackSubscriptionCode: subscriptionCode }
          : {}),
        updatedAt: now,
      })
      .where(eq(subscriptions.paystackCustomerCode, customerCode));

    console.log(
      `[Webhook] Subscription confirmed via subscription.create — customer: ${customerCode}, code: ${subscriptionCode ?? "n/a"}`,
    );
  } catch (err) {
    console.error("[Webhook] Failed to handle subscription.create:", err);
  }
}

/**
 * subscription.disable — the subscription has been cancelled (by the customer
 * or due to repeated payment failures).
 */
async function handleSubscriptionDisable(data: Record<string, unknown>) {
  try {
    const customerCode = (data.customer as Record<string, unknown>)
      ?.customer_code as string;

    if (!customerCode) {
      console.warn("[Webhook] subscription.disable — no customer code found");
      return;
    }

    await db
      .update(subscriptions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(subscriptions.paystackCustomerCode, customerCode));

    console.log(`[Webhook] Subscription cancelled — customer: ${customerCode}`);
  } catch (err) {
    console.error("[Webhook] Failed to handle subscription.disable:", err);
  }
}

/**
 * invoice.payment_failed — a recurring charge attempt failed.
 * Mark the subscription inactive so the quota gate kicks in.
 */
async function handlePaymentFailed(data: Record<string, unknown>) {
  try {
    const customerCode = (data.customer as Record<string, unknown>)
      ?.customer_code as string;

    if (!customerCode) return;

    await db
      .update(subscriptions)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(subscriptions.paystackCustomerCode, customerCode));

    console.log(
      `[Webhook] Subscription marked inactive after payment failure — customer: ${customerCode}`,
    );
  } catch (err) {
    console.error("[Webhook] Failed to handle invoice.payment_failed:", err);
  }
}

/**
 * invoice.update — fires on successful recurring charges. Rolls the
 * currentPeriodEnd forward so time-based quota checks stay accurate.
 */
async function handleInvoiceUpdate(data: Record<string, unknown>) {
  try {
    const customerCode = (data.customer as Record<string, unknown>)
      ?.customer_code as string;
    const paid = data.paid as boolean | undefined;

    if (!customerCode || !paid) return;

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    await db
      .update(subscriptions)
      .set({
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        updatedAt: now,
      })
      .where(
        and(
          eq(subscriptions.paystackCustomerCode, customerCode),
          eq(subscriptions.status, "active"),
        ),
      );

    console.log(
      `[Webhook] Period extended via invoice.update — customer: ${customerCode}`,
    );
  } catch (err) {
    console.error("[Webhook] Failed to handle invoice.update:", err);
  }
}

export default webhookRoutes;
