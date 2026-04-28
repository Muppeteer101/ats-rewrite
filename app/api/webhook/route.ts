import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { redis, k } from '@/lib/redis';
import { sendCreditsTopUpEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const maxDuration = 30;

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Stripe webhook — handles `checkout.session.completed` events for credit-pack
 * purchases.
 *
 * Critical ordering rule: ALWAYS credit the user FIRST. Only after the credit
 * grant succeeds do we mark the event as processed (idempotency) and run any
 * best-effort side effects (emails, attribution). If a side-effect fails, the
 * user still has their credits — the next Stripe retry will see the
 * idempotency marker and short-circuit.
 *
 * Why this matters (Apr 2026 incident): the original implementation set the
 * idempotency marker before attempting an over-deep `stripe.checkout.sessions.retrieve`
 * call (`expand: ['total_details.breakdown.discounts.discount.coupon']` — 5
 * levels, max is 4). The Stripe call threw, the handler 500'd, but the marker
 * was already set, so Stripe's retries hit "deduped" → 200 → stopped retrying,
 * leaving the user paid-but-uncredited.
 */
export async function POST(req: NextRequest): Promise<Response> {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET not set' }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json({ error: `signature verification failed: ${(e as Error).message}` }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const meta = session.metadata ?? {};

  // Site filter — this Stripe account is shared across the portfolio.
  if (meta.site !== 'ATSR') {
    return NextResponse.json({ received: true, ignored: 'wrong site' });
  }

  const clerkUserId = meta.clerkUserId;
  const credits = Number(meta.credits ?? 0);
  if (!clerkUserId || credits <= 0) {
    return NextResponse.json({ error: 'missing metadata' }, { status: 400 });
  }

  // Idempotency check (read only — we don't WRITE the marker until credits are granted)
  const eventKey = k.stripeEvent(event.id);
  const already = await redis.get<string>(eventKey);
  if (already) {
    return NextResponse.json({ received: true, deduped: true });
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 1: Credit the user. This is the only step that MUST succeed for
  // the customer to get what they paid for. Everything else is best-effort.
  //
  // Writes to the central `al:credits:{userId}` key — same key the rest of
  // the Almost Legal portfolio reads from, and the same key consumeImrCredit
  // (lib/credits-central.ts) decrements on rewrite. INCRBY is atomic, so
  // concurrent webhook deliveries can't lose a top-up.
  // ──────────────────────────────────────────────────────────────────────
  const paidCreditsNow = await redis.incrby(`al:credits:${clerkUserId}`, credits);
  await redis.set(eventKey, '1', { ex: 60 * 60 * 24 * 30 });

  // ──────────────────────────────────────────────────────────────────────
  // STEP 2: Best-effort side effects. Each is wrapped in try/catch — a
  // failure here does NOT 500 the response, because credits already landed.
  // ──────────────────────────────────────────────────────────────────────

  // Email receipt
  const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
  if (customerEmail) {
    try {
      const total =
        session.amount_total != null && session.currency
          ? new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: session.currency.toUpperCase(),
            }).format(session.amount_total / 100)
          : `pack of ${credits}`;
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
      sendCreditsTopUpEmail({
        to: customerEmail,
        credits,
        total,
        dashboardUrl: `${baseUrl}/dashboard`,
      }).catch((e) => console.error('topup email failed', e));
    } catch (e) {
      console.error('topup email setup failed', e);
    }
  }

  // Re-fetch session for discount/coupon attribution + share-code rewards.
  // Expansion is capped at 4 levels by Stripe's API — keep paths shallow and
  // hydrate sub-objects via separate fetches if needed.
  let discounts: Array<{
    discount?: {
      coupon?: string | { id: string } | null;
      promotion_code?: string | null;
    };
  }> = [];
  let amountTotal: number | null = session.amount_total ?? null;
  let currency: string | null = session.currency ?? null;
  try {
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['total_details.breakdown.discounts'],
    });
    amountTotal = fullSession.amount_total ?? amountTotal;
    currency = fullSession.currency ?? currency;
    discounts = (fullSession.total_details?.breakdown?.discounts ?? []) as typeof discounts;
  } catch (e) {
    console.error('session re-fetch for attribution failed', e);
  }

  // Share-code reward path: if the buyer used a personal share code, reward
  // the original sharer with a free-base coupon. Look up the human-readable
  // code from each discount's promotion_code by fetching it separately
  // (since deeper expansion isn't allowed).
  if (customerEmail) {
    for (const d of discounts) {
      const promoIdOrObj = d.discount?.promotion_code;
      if (!promoIdOrObj) continue;
      try {
        const promoId =
          typeof promoIdOrObj === 'string' ? promoIdOrObj : null;
        if (!promoId) continue;
        const promoObj = await stripe.promotionCodes.retrieve(promoId);
        const usedCode = promoObj.code;
        if (!usedCode) continue;

        const ownerEmail = await redis.get<string>(`share:owner:${usedCode}`);
        if (ownerEmail && ownerEmail !== customerEmail) {
          const rewardPromo = await stripe.promotionCodes.create({
            promotion: { coupon: 'REWARD_FREE_BASE', type: 'coupon' },
            max_redemptions: 1,
            metadata: { earnedBy: ownerEmail, usedBy: customerEmail, site: 'ATSR' },
          });
          const { sendReferrerRewardEmail } = await import('@/lib/email');
          sendReferrerRewardEmail({
            to: ownerEmail,
            rewardCode: rewardPromo.code,
            buyerName: session.customer_details?.name ?? undefined,
          }).catch((e) => console.error('referrer reward email failed', e));
        }
      } catch (e) {
        console.error('referrer reward path failed', e);
      }
    }
  }

  // Creator-attribution: fire-and-forget POST to almostlegal.ai/api/track/sale.
  try {
    const firstCoupon = discounts[0]?.discount?.coupon;
    const couponId =
      typeof firstCoupon === 'string'
        ? firstCoupon
        : firstCoupon?.id ?? null;

    if (couponId && process.env.CREATOR_TRACK_SECRET && amountTotal != null) {
      const trackUrl = process.env.CREATOR_TRACK_URL ?? 'https://almostlegal.ai/api/track/sale';
      const brand = process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? 'toolykit.ai';
      fetch(trackUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-track-secret': process.env.CREATOR_TRACK_SECRET,
        },
        body: JSON.stringify({
          code: couponId,
          brand,
          amountMinor: amountTotal,
          currency: (currency ?? 'gbp').toUpperCase(),
        }),
      }).catch((e) => console.error('creator track/sale failed', e));
    }
  } catch (e) {
    console.error('creator attribution setup failed', e);
  }

  return NextResponse.json({
    received: true,
    creditsAdded: credits,
    paidCreditsNow,
  });
}
