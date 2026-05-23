import { Queue } from "bullmq";
import Redis from "ioredis";
import { config } from "./config";

export const CV_SCORING_QUEUE = "cv-scoring";

// Upstash Redis requires TLS and maxRetriesPerRequest: null for BullMQ
const connection = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: config.redis.url.startsWith("rediss://")
    ? { rejectUnauthorized: false }
    : undefined,
});

export const cvScoringQueue = new Queue(CV_SCORING_QUEUE, { connection });

export interface CvScoringJobData {
  applicationId: string;
  jobId: string;
  cvUrl: string;
  jobTitle: string;
  jobDescription: string;
  requirements: string | null;
}

/**
 * Adds a CV scoring job to the queue.
 * The hirex-ai-worker picks this up and calls Gemini.
 */
export async function enqueueCvScoring(data: CvScoringJobData): Promise<void> {
  await cvScoringQueue.add("score-cv", data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // retry after 5s, 10s, 20s
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  });
}
