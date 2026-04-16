import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { stripe, priceIdFor, type PackSize } from '@/lib/stripe';
import { isSupportedCurrency, type Currency } from '@/lib/fx';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Creates a Stripe Checkout session for a credit pack purchase.
 *
 * Body: { pack: 3 | 10, currency: GBP|USD|EUR|AUD|CAD|NZD }
 *
 * Returns: { url: string } — front-end redirects the browser to this URL.
 *
 * Creator attribution: if an `al_ref` cookie is present, look up the
 * matching Stripe promotion code and auto-apply it (20% off). This mirrors
 * the pattern in /Users/openclaw/cancelmyparkingticket/app/api/checkout/route.ts.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { pack?: number };
  const packNum = Number(body.pack);
  const pack: PackSize | null = packNum === 3 ? 3 : packNum === 10 ? 10 : null;
  if (!pack) {
    return NextResponse.json({ error: "pack must be 3 or 10" }, { status: 400 });
  }

  // Currency is LOCKED to the user's geo-IP — derived from the
  // Vercel-set `x-vercel-ip-country` header, NEVER from client input.
  // Stops a UK visitor from picking USD to arbitrage FX.
  const { geoFromHeaders } = await import('@/lib/geo');
  const geo = geoFromHeaders(req.headers);
  const currency: Currency = geo.currency;
  if (!isSupportedCurrency(currency)) {
    return NextResponse.json({ error: `unsupported currency: ${currency}` }, { status: 400 });
  }

  const user = await currentUser();
  const customerEmail = user?.primaryEmailAddress?.emailAddress;
  const priceId = priceIdFor(currency, pack);

  // Creator-code auto-apply via al_ref cookie.
  const cookieHeader = req.headers.get('cookie') ?? '';
  const refMatch = cookieHeader.match(/(?:^|;\s*)al_ref=([^;]+)/);
  const alRef = refMatch ? decodeURIComponent(refMatch[1]) : null;

  let discounts: { promotion_code: string }[] | undefined;
  if (alRef && /^[A-Z0-9]{4,32}$/i.test(alRef)) {
    try {
      const promos = await stripe.promotionCodes.list({ code: alRef, active: true, limit: 1 });
      if (promos.data[0]?.id) {
        discounts = [{ promotion_code: promos.data[0].id }];
      }
    } catch {
      /* never block checkout on a creator-code lookup failure */
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: customerEmail,
    client_reference_id: alRef ?? undefined,
    discounts,
    // metadata travels through to the webhook so we know who to credit.
    metadata: {
      site: 'ATSR',           // webhook filter — same pattern as WMLL/CMPT
      clerkUserId: userId,
      pack: String(pack),
      credits: String(pack),  // packsize === credits granted (3 or 10)
      currency,
      ref: alRef ?? '',
    },
    success_url: `${baseUrl}/dashboard?topup=success&pack=${pack}`,
    cancel_url: `${baseUrl}/dashboard?topup=cancelled`,
    allow_promotion_codes: !discounts, // let users type a code if no auto-apply
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
