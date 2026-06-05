import { Queue } from "bullmq";
import Redis from "ioredis";
import { config } from "./config";

export const CV_SCORING_QUEUE = "cv-scoring";

// Lazy singletons — created on first use so a missing Redis URL
// doesn't crash the server at startup (auth routes still work fine).
let _connection: Redis | null = null;
let _queue: Queue | null = null;

function getConnection(): Redis {
  if (!_connection) {
    if (!config.redis.url) throw new Error("REDIS_URL is not set");
    _connection = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: config.redis.url.startsWith("rediss://")
        ? { rejectUnauthorized: false }
        : undefined,
    });
    _connection.on("error", (err) => {
      console.error("[Redis] connection error:", err.message);
    });
  }
  return _connection;
}

function getQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(CV_SCORING_QUEUE, { connection: getConnection() });
  }
  return _queue;
}

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
 * If Redis is unavailable the error is logged but does NOT crash the request.
 */
export async function enqueueCvScoring(data: CvScoringJobData): Promise<void> {
  try {
    await getQueue().add("score-cv", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });
  } catch (err) {
    console.error("[Queue] failed to enqueue CV scoring job:", err);
    // Don't re-throw — application was saved, scoring will be retried later
  }
}
