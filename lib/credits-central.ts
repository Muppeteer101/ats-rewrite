/**
 * Central Almost Legal credit consumption for Improve My Resume.
 *
 * Credits live in the shared Upstash instance under `al:` keys —
 * same pool as almostlegal.ai, cancelmyparkingticket.com, etc.
 * One credit = one rewrite. Monthly-free use is tracked separately.
 *
 * Precedence:
 *   1. Monthly-free (one per calendar month, requires account)
 *   2. Central paid credits (al:credits:{userId})
 *   3. null → caller returns 402
 */

import { redis } from './redis';

// Key schema mirrors lib/redis.ts on almostlegal.ai — must stay in sync.
const ck = {
  credits:  (userId: string) => `al:credits:${userId}`,
  freeUse:  (userId: string) => `al:free:${userId}:improve-my-resume`,
};

export type ImrCreditSource = 'monthly-free' | 'paid';

function isSameMonth(timestampMs: number): boolean {
  const used  = new Date(timestampMs);
  const now   = new Date();
  return used.getMonth() === now.getMonth() && used.getFullYear() === now.getFullYear();
}

/**
 * Consume one IMR credit.
 * Returns the source used, or null if the user has no credits available.
 */
export async function consumeImrCredit(userId: string): Promise<ImrCreditSource | null> {
  // 1. Monthly free
  const freeTs = await redis.get<number>(ck.freeUse(userId));
  if (freeTs === null || !isSameMonth(freeTs)) {
    await redis.set(ck.freeUse(userId), Date.now());
    return 'monthly-free';
  }

  // 2. Central paid credits
  const credits = await redis.get<number>(ck.credits(userId));
  if (credits !== null && credits > 0) {
    await redis.decrby(ck.credits(userId), 1);
    return 'paid';
  }

  return null;
}

/**
 * Read-only credit status — for banners and gating checks.
 */
export async function getImrCreditStatus(userId: string): Promise<{
  hasMonthlyFree: boolean;
  paidCredits: number;
  total: number;
}> {
  const [freeTs, credits] = await Promise.all([
    redis.get<number>(ck.freeUse(userId)),
    redis.get<number>(ck.credits(userId)),
  ]);

  const hasMonthlyFree = freeTs === null || !isSameMonth(freeTs);
  const paidCredits    = credits ?? 0;

  return {
    hasMonthlyFree,
    paidCredits,
    total: (hasMonthlyFree ? 1 : 0) + paidCredits,
  };
}
