import Stripe from 'stripe';

// Lazy init — `next build` evaluates this module while collecting page data
// before .env is loaded. Throwing at top level breaks the build; throwing on
// first actual use surfaces a clean error in the route handler instead.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Export a Proxy so existing callsites (`stripe.checkout.sessions.create(...)`)
// keep working without any code changes.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const s = getStripe() as unknown as Record<string | symbol, unknown>;
    return s[prop];
  },
});

import type { Currency } from '@/lib/fx';

export type PackSize = 3 | 10;

/** Resolve the Stripe price ID for a (currency, packSize) tuple. */
export function priceIdFor(currency: Currency, pack: PackSize): string {
  const key = `STRIPE_PRICE_${currency}_PACK${pack}` as const;
  const id = process.env[key];
  if (!id) throw new Error(`Missing env: ${key}`);
  return id;
}

/** All packs offered, in display order on the upsell modal. */
export const PACKS: ReadonlyArray<{
  pack: PackSize;
  credits: number;
  highlight?: boolean;
  perCredit: Record<Currency, string>;
  total: Record<Currency, string>;
}> = [
  {
    pack: 3,
    credits: 3,
    perCredit: { GBP: '£3.33', USD: '$3.33', EUR: '€3.33', AUD: 'A$5.00', CAD: 'C$4.33', NZD: 'NZ$5.33' },
    total: { GBP: '£9.99', USD: '$9.99', EUR: '€9.99', AUD: 'A$15', CAD: 'C$13', NZD: 'NZ$16' },
  },
  {
    pack: 10,
    credits: 10,
    highlight: true,
    perCredit: { GBP: '£2.00', USD: '$2.00', EUR: '€2.00', AUD: 'A$3.00', CAD: 'C$2.60', NZD: 'NZ$3.20' },
    total: { GBP: '£19.99', USD: '$19.99', EUR: '€19.99', AUD: 'A$30', CAD: 'C$26', NZD: 'NZ$32' },
  },
];
