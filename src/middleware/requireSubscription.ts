import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { subscriptions } from "../db/schema";

/**
 * Blocks the request if the company does not have an active subscription.
 * Must be used after requireAuth so c.get("company") is available.
 */
export async function requireSubscription(c: Context, next: Next) {
  const { sub } = c.get("company");

  const [subscription] = await db
    .select({ status: subscriptions.status, plan: subscriptions.plan })
    .from(subscriptions)
    .where(eq(subscriptions.companyId, sub))
    .limit(1);

  if (!subscription || subscription.status !== "active") {
    return c.json(
      {
        success: false,
        message:
          "An active subscription is required to post jobs. Please upgrade your plan.",
        code: "SUBSCRIPTION_REQUIRED",
      },
      403,
    );
  }

  await next();
}
