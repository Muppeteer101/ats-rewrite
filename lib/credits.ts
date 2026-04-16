import { redis, k, currentMonthKey } from '@/lib/redis';

/**
 * Credit accounting. The pricing model is:
 *   1. First-ever rewrite is FREE (lifetimeFreeUsed flag).
 *   2. After that, ONE additional free rewrite per calendar month
 *      (monthlyFreeUsed flag, reset when monthKey rolls).
 *   3. Beyond that, paid credits are consumed (paidCredits counter).
 *      Packs are 3 for £9.99 or 10 for £19.99.
 *
 * State is keyed by Clerk userId so a user signed in across devices
 * sees one consistent balance.
 */
export type CreditState = {
  /** Credits purchased via Stripe pack(s). */
  paidCredits: number;
  /** YYYY-MM bucket for the current month's free allowance. */
  monthKey: string;
  /** True if the monthly-free has been consumed in `monthKey`. */
  monthlyFreeUsed: boolean;
  /** True after the very first rewrite is consumed. Lifetime flag. */
  lifetimeFreeUsed: boolean;
  /** ms epoch of last update — used for dashboard "last activity" display. */
  updatedAt: number;
};

export type RewriteRef = {
  id: string;
  jobTitle: string;
  date: number; // ms epoch
  scoreBefore: number;
  scoreAfter: number;
  pdfTemplate: string;
};

export type CreditSource = 'lifetime-free' | 'monthly-free' | 'paid';

const DEFAULT_STATE: CreditState = {
  paidCredits: 0,
  monthKey: currentMonthKey(),
  monthlyFreeUsed: false,
  lifetimeFreeUsed: false,
  updatedAt: 0,
};

export async function getCreditState(userId: string): Promise<CreditState> {
  const raw = await redis.get<CreditState>(k.user(userId));
  if (!raw) return { ...DEFAULT_STATE };
  // Roll the month bucket if needed (lazy reset — no cron required).
  const month = currentMonthKey();
  if (raw.monthKey !== month) {
    return { ...raw, monthKey: month, monthlyFreeUsed: false };
  }
  return raw;
}

/**
 * Atomically determine + record which credit source pays for the next rewrite.
 * Returns the source consumed, or null if the user has no credits and must buy.
 *
 * Order of consumption:
 *   1. lifetime-free (first rewrite ever)
 *   2. monthly-free (one per calendar month)
 *   3. paid credits
 *
 * Note: Upstash REST doesn't support multi-key transactions, so this is a
 * read-modify-write. In practice the race window is microseconds and the
 * worst case is one extra free rewrite given out — acceptable.
 */
export async function consumeCredit(userId: string): Promise<CreditSource | null> {
  const state = await getCreditState(userId);
  let source: CreditSource | null = null;

  if (!state.lifetimeFreeUsed) {
    state.lifetimeFreeUsed = true;
    source = 'lifetime-free';
  } else if (!state.monthlyFreeUsed) {
    state.monthlyFreeUsed = true;
    source = 'monthly-free';
  } else if (state.paidCredits > 0) {
    state.paidCredits -= 1;
    source = 'paid';
  } else {
    return null;
  }

  state.updatedAt = Date.now();
  await redis.set(k.user(userId), state);
  return source;
}

/** Add purchased credits to the user (called from Stripe webhook). */
export async function addPaidCredits(userId: string, credits: number): Promise<CreditState> {
  const state = await getCreditState(userId);
  state.paidCredits += credits;
  state.updatedAt = Date.now();
  await redis.set(k.user(userId), state);
  return state;
}

/** "Available to use right now" — sum of paid + any unused free buckets. */
export function availableCount(state: CreditState): number {
  let n = state.paidCredits;
  if (!state.lifetimeFreeUsed) n += 1;
  if (!state.monthlyFreeUsed) n += 1;
  return n;
}

/** Human-readable summary for the dashboard — e.g. "3 paid + 1 free this month". */
export function summary(state: CreditState): string {
  const parts: string[] = [];
  if (state.paidCredits > 0) parts.push(`${state.paidCredits} paid`);
  if (!state.lifetimeFreeUsed) parts.push('1 free welcome');
  if (!state.monthlyFreeUsed && state.lifetimeFreeUsed) parts.push('1 free this month');
  if (parts.length === 0) return '0 credits — top up to continue';
  return parts.join(' + ');
}

/** ISO date of the next monthly-free reset (1st of next month UTC). */
export function nextResetDate(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

/** Append a rewrite to the user's history (sorted by timestamp, newest first). */
export async function recordRewrite(userId: string, ref: RewriteRef): Promise<void> {
  await redis.zadd(k.rewrites(userId), { score: ref.date, member: JSON.stringify(ref) });
}

/** Read the most recent N rewrites for the dashboard. */
export async function listRewrites(userId: string, limit = 50): Promise<RewriteRef[]> {
  const raw = await redis.zrange<string[]>(k.rewrites(userId), 0, limit - 1, { rev: true });
  return raw
    .map((s) => {
      try {
        return JSON.parse(s) as RewriteRef;
      } catch {
        return null;
      }
    })
    .filter((r): r is RewriteRef => r !== null);
}
