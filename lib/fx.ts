// Multi-currency converter — lifted from almostlegal-ai/lib/fx.ts.
// ECB reference rates via frankfurter.app, cached in Redis for 12h.

import { redis } from '@/lib/redis';

export const SUPPORTED_CURRENCIES = ['GBP', 'USD', 'EUR', 'AUD', 'CAD', 'NZD'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

const CACHE_KEY = 'fx:rates:eur';
const CACHE_TTL_SECONDS = 12 * 60 * 60;

type RatesByCurrency = Record<string, number>;

async function fetchRatesFromFrankfurter(): Promise<RatesByCurrency> {
  const symbols = SUPPORTED_CURRENCIES.filter((c) => c !== 'EUR').join(',');
  const res = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${symbols}`, {
    next: { revalidate: CACHE_TTL_SECONDS },
  });
  if (!res.ok) throw new Error(`frankfurter ${res.status}`);
  const data = (await res.json()) as { rates: RatesByCurrency };
  return { ...data.rates, EUR: 1 };
}

async function getEurRates(): Promise<RatesByCurrency> {
  const cached = await redis.get<RatesByCurrency>(CACHE_KEY);
  if (cached && typeof cached === 'object') return cached;
  const fresh = await fetchRatesFromFrankfurter();
  await redis.set(CACHE_KEY, fresh, { ex: CACHE_TTL_SECONDS });
  return fresh;
}

export async function convert(amount: number, from: string, to: string): Promise<number> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return amount;
  if (!SUPPORTED_CURRENCIES.includes(f as Currency)) throw new Error(`unsupported currency: ${f}`);
  if (!SUPPORTED_CURRENCIES.includes(t as Currency)) throw new Error(`unsupported currency: ${t}`);
  const rates = await getEurRates();
  const inEur = amount / (rates[f] ?? 1);
  return inEur * (rates[t] ?? 1);
}

export function isSupportedCurrency(c: string): c is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(c.toUpperCase());
}

/** Format a minor-units integer as a localised currency string. */
export function fmtMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100);
}
