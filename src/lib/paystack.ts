import axios from "axios";
import { config } from "./config";

const paystackClient = axios.create({
  baseURL: "https://api.paystack.co",
  headers: {
    Authorization: `Bearer ${config.paystack.secretKey}`,
    "Content-Type": "application/json",
  },
});

// ─── Subscription Plans ────────────────────────────────
// Prices in NGN. Paystack requires amounts in kobo (× 100).
export const PLANS = {
  starter: {
    key: "starter",
    name: "Starter",
    priceNGN: 15_000,
    amountKobo: 1_500_000,
    jobLimit: 5,
    tagline: "Perfect for teams that hire occasionally",
    features: [
      "5 active job postings",
      "AI-powered CV scoring",
      "Automated candidate emails",
      "Hiring pipeline management",
      "Email support",
    ],
  },
  growth: {
    key: "growth",
    name: "Growth",
    priceNGN: 35_000,
    amountKobo: 3_500_000,
    jobLimit: 20,
    tagline: "For companies with regular hiring velocity",
    features: [
      "20 active job postings",
      "AI-powered CV scoring",
      "Automated candidate emails",
      "Hiring pipeline management",
      "Advanced applicant analytics",
      "Priority email support",
    ],
  },
  scale: {
    key: "scale",
    name: "Scale",
    priceNGN: 75_000,
    amountKobo: 7_500_000,
    jobLimit: -1, // unlimited
    tagline: "Unlimited hiring for high-growth organisations",
    features: [
      "Unlimited job postings",
      "AI-powered CV scoring",
      "Automated candidate emails",
      "Hiring pipeline management",
      "Advanced applicant analytics",
      "Dedicated account support",
      "Custom pipeline stages",
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// ─── Paystack API Wrappers ─────────────────────────────

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/**
 * Creates a Paystack payment session for a given plan.
 * Returns the authorization URL the company is redirected to.
 */
export async function initializeTransaction(
  email: string,
  planKey: PlanKey,
  companyId: string,
): Promise<InitializeTransactionResult> {
  const plan = PLANS[planKey];

  const { data } = await paystackClient.post("/transaction/initialize", {
    email,
    amount: plan.amountKobo,
    currency: "NGN",
    callback_url: `${process.env.FRONTEND_URL}/billing/verify`,
    metadata: {
      companyId,
      plan: planKey,
      custom_fields: [
        { display_name: "Plan", variable_name: "plan", value: plan.name },
        {
          display_name: "Company ID",
          variable_name: "company_id",
          value: companyId,
        },
      ],
    },
  });

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

export interface VerifyTransactionResult {
  status: "success" | "failed" | "abandoned";
  reference: string;
  amount: number;
  companyId: string;
  plan: PlanKey;
  customerCode: string;
}

/**
 * Verifies a Paystack transaction by reference.
 * Used both by the webhook and the verify endpoint.
 */
export async function verifyTransaction(
  reference: string,
): Promise<VerifyTransactionResult> {
  const { data } = await paystackClient.get(`/transaction/verify/${reference}`);
  const tx = data.data;

  return {
    status: tx.status,
    reference: tx.reference,
    amount: tx.amount,
    companyId: tx.metadata?.companyId ?? "",
    plan: (tx.metadata?.plan ?? "starter") as PlanKey,
    customerCode: tx.customer?.customer_code ?? "",
  };
}
