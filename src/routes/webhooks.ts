import { Hono } from "hono";
import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { subscriptions } from "../db/schema";
import { config } from "../lib/config";
import { verifyTransaction, type PlanKey } from "../lib/paystack";

const webhookRoutes = new Hono();

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

  // 4. Handle events
  switch (eventType) {
    case "charge.success": {
      await handleChargeSuccess(data);
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

    default:
      // Acknowledge unhandled events without doing anything
      break;
  }

  // Paystack expects a 200 immediately — never leave it hanging
  return c.json({ received: true });
});

// ─── Event Handlers ───────────────────────────────────

async function handleChargeSuccess(data: Record<string, unknown>) {
  try {
    const reference = data.reference as string;
    const tx = await verifyTransaction(reference);

    if (tx.status !== "success" || !tx.companyId) {
      console.warn(
        `[Webhook] charge.success skipped — status: ${tx.status}, companyId: ${tx.companyId}`,
      );
      return;
    }

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
      `[Webhook] Subscription activated — company: ${tx.companyId}, plan: ${tx.plan}`,
    );
  } catch (err) {
    console.error("[Webhook] Failed to handle charge.success:", err);
  }
}

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

export default webhookRoutes;
