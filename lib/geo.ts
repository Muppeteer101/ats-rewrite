// Geo → currency mapping. Vercel's edge automatically sets the
// `x-vercel-ip-country` header (ISO 3166-1 alpha-2) on every request.
// We map country → currency once and lock the user to that currency at
// checkout — no UI override — so a UK visitor can't pay in $ to arbitrage
// FX (about 15% on £9.99 vs $9.99 at current rates).

import type { Currency } from '@/lib/fx';

// Eurozone countries — anyone here gets EUR pricing.
const EUROZONE = new Set([
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
]);

export type GeoInfo = {
  country: string | null;       // ISO alpha-2, or null if undetectable
  currency: Currency;           // resolved currency
  detected: boolean;            // false when we fell back to default
};

/** Resolve a 2-letter country code to one of our supported currencies. */
export function currencyForCountry(country: string | null | undefined): Currency {
  if (!country) return 'USD';
  const c = country.toUpperCase();
  if (c === 'GB') return 'GBP';
  if (c === 'US') return 'USD';
  if (c === 'AU') return 'AUD';
  if (c === 'CA') return 'CAD';
  if (c === 'NZ') return 'NZD';
  if (EUROZONE.has(c)) return 'EUR';
  // Reasonable defaults for everywhere else: USD is the universal fallback.
  return 'USD';
}

/** Read geo from request headers (Vercel-set) and resolve a currency. */
export function geoFromHeaders(h: Headers): GeoInfo {
  const country = h.get('x-vercel-ip-country');
  return {
    country: country ?? null,
    currency: currencyForCountry(country),
    detected: !!country,
  };
}

/** Human-readable label of a country code → "United Kingdom", etc. */
export function countryName(code: string | null): string {
  if (!code) return 'your region';
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    return dn.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
