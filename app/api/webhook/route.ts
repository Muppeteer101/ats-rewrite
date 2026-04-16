import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { redis, k } from '@/lib/redis';
import { addPaidCredits } from '@/lib/credits';
import { sendCreditsTopUpEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const maxDuration = 30;

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Stripe webhook — handles `checkout.session.completed` events for credit-pack
 * purchases. Pattern lifted from /Users/openclaw/writemylegalletter/app/api/webhook/route.ts.
 *
 * Side effects on a successful pack purchase:
 *   1. INCRBY paid credits on the Clerk user (via lib/credits.addPaidCredits).
 *   2. Send Resend "credits added" receipt email.
 *   3. Fire-and-forget POST to almostlegal.ai/api/track/sale for creator
 *      attribution (only if a coupon was applied at checkout).
 *
 * Idempotency: we record processed event IDs so Stripe's webhook retry
 * mechanism can't double-credit the user.
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

  // Idempotency guard — checked AFTER metadata validation so retries of a
  // crashed handler can re-attempt the work. The marker is only persisted
  // once `addPaidCredits` succeeds (see below) — if a previous attempt failed
  // before that line, no marker exists and Stripe's retry will re-run the work.
  const eventKey = k.stripeEvent(event.id);
  const already = await redis.get<string>(eventKey);
  if (already) {
    return NextResponse.json({ received: true, deduped: true });
  }

  // Re-fetch with discount expansion so we can grab the coupon ID for attribution.
  const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['total_details.breakdown.discounts.discount.coupon'],
  });

  // Credit the user FIRST. Only after this succeeds do we mark the event as
  // processed — that way a crash in any later step (email send, attribution
  // fetch) won't permanently block the credit grant on Stripe's retries.
  const newState = await addPaidCredits(clerkUserId, credits);
  await redis.set(eventKey, '1', { ex: 60 * 60 * 24 * 30 });

  // Customer email + receipt.
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  if (email) {
    const total =
      fullSession.amount_total != null && fullSession.currency
        ? new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: fullSession.currency.toUpperCase(),
          }).format(fullSession.amount_total / 100)
        : `pack of ${credits}`;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    sendCreditsTopUpEmail({
      to: email,
      credits,
      total,
      dashboardUrl: `${baseUrl}/dashboard`,
    }).catch((e) => {
      console.error('topup email failed', e);
    });
  }

  // Re-fetch with the promotion_code expansion too — needed for the
  // share-code-redemption reward path below (not just creator attribution).
  const fullSessionWithPromo = await stripe.checkout.sessions.retrieve(session.id, {
    expand: [
      'total_details.breakdown.discounts.discount.coupon',
      'total_details.breakdown.discounts.discount.promotion_code',
    ],
  });

  type DiscountSlot = {
    discount?: {
      coupon?: { id: string } | null;
      promotion_code?: string | { code: string } | null;
    };
  };
  const allDiscounts = (fullSessionWithPromo.total_details?.breakdown?.discounts ?? []) as DiscountSlot[];

  // 1. Reward sharer if buyer used a personal share code (50%-off coupon)
  if (email) {
    for (const d of allDiscounts) {
      const promo = d.discount?.promotion_code;
      if (!promo) continue;
      const usedCode = typeof promo === 'string' ? promo : promo.code;
      if (!usedCode) continue;
      try {
        const ownerEmail = await redis.get<string>(`share:owner:${usedCode}`);
        if (ownerEmail && ownerEmail !== email) {
          const rewardPromo = await stripe.promotionCodes.create({
            promotion: { coupon: 'REWARD_FREE_BASE', type: 'coupon' },
            max_redemptions: 1,
            metadata: { earnedBy: ownerEmail, usedBy: email, site: 'TOOLYKIT' },
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

  // 2. Creator-attribution: fire-and-forget to almostlegal.ai's tracker.
  // Same pattern as cancelmyparkingticket — see creator-programme-handoff.md.
  type DiscountWithCoupon = { discount: { coupon: { id: string } } };
  const firstDiscount = fullSession.total_details?.breakdown?.discounts?.[0] as
    | DiscountWithCoupon
    | undefined;
  const couponId = firstDiscount?.discount?.coupon?.id ?? null;
  if (couponId && process.env.CREATOR_TRACK_SECRET && fullSession.amount_total != null) {
    const trackUrl = process.env.CREATOR_TRACK_URL ?? 'https://almostlegal.ai/api/track/sale';
    const brand = process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? 'ats-rewriter.com';
    fetch(trackUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-track-secret': process.env.CREATOR_TRACK_SECRET,
      },
      body: JSON.stringify({
        code: couponId,
        brand,
        amountMinor: fullSession.amount_total,
        currency: (fullSession.currency ?? 'gbp').toUpperCase(),
      }),
    }).catch((e) => {
      console.error('creator track/sale failed', e);
    });
  }

  return NextResponse.json({
    received: true,
    creditsAdded: credits,
    paidCreditsNow: newState.paidCredits,
  });
}
