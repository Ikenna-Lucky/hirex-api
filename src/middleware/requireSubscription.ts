import type { Context, Next } from "hono";
import { eq, count } from "drizzle-orm";
import { db } from "../db";
import { subscriptions, jobs } from "../db/schema";

/**
 * Free-quota job-creation gate.
 *
 * Rules:
 *  • 0 jobs posted so far  → allow (free first post)
 *  • 1+ jobs posted, no active subscription → block (FREE_QUOTA_EXHAUSTED)
 *  • Active subscription → allow (unlimited per plan)
 *
 * Must be used after requireAuth so c.get("company") is available.
 */
export async function requireSubscription(c: Context, next: Next) {
  const { sub } = c.get("company");

  // Run both checks in parallel
  const [[{ total }], [subscription]] = await Promise.all([
    db.select({ total: count() }).from(jobs).where(eq(jobs.companyId, sub)),

    db
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.companyId, sub))
      .limit(1),
  ]);

  const jobCount = Number(total);
  const isSubscribed = subscription?.status === "active";

  // Active subscriber → unlimited
  if (isSubscribed) return await next();

  // First post ever → free pass
  if (jobCount === 0) return await next();

  // Free quota exhausted
  return c.json(
    {
      success: false,
      message:
        "You've used your 1 free role post. Upgrade to a paid plan to post more.",
      code: "FREE_QUOTA_EXHAUSTED",
    },
    403,
  );
}
