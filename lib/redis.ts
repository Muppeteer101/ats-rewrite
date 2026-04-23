import { Redis } from '@upstash/redis';

/**
 * Upstash Redis client — auto-reads UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN from env (provisioned by Vercel Marketplace).
 *
 * All keys are namespaced under `cv-` so this product can share a Redis
 * instance with the rest of the Almost Legal portfolio without colliding.
 */
export const redis = Redis.fromEnv();

export const k = {
  // User state — credits balance, monthly free flag, lifetime free flag.
  user: (clerkUserId: string) => `cv-user:${clerkUserId}`,

  // Per-user list of rewrite IDs (sorted set, score = timestamp ms).
  rewrites: (clerkUserId: string) => `cv-rewrites:${clerkUserId}`,

  // Individual rewrite payload — JSON of {jdAnalysis, cvAnalysis, rewrite, score, pdfTemplate, jobTitle}.
  rewrite: (rewriteId: string) => `cv-rewrite:${rewriteId}`,

  // Intermediate analysis snapshot (pre-rewrite) — persisted between stages.
  // 24-hour TTL: long enough for a user to start analysis, consider, and pay.
  analysis: (analysisId: string) => `cv-analysis:${analysisId}`,

  // Pre-computed PDF binary cache (base64) so dashboard re-downloads don't re-render.
  pdfCache: (rewriteId: string, template: string) => `cv-pdf:${rewriteId}:${template}`,

  // Idempotency for Stripe webhook (prevent double-credit on retries).
  stripeEvent: (eventId: string) => `cv-stripe-evt:${eventId}`,
};

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}
