import { NextRequest, NextResponse } from 'next/server';
import { geoFromHeaders, countryName } from '@/lib/geo';

export const runtime = 'nodejs';

/**
 * GET /api/geo
 *
 * Returns the user's locked currency for billing purposes — derived from
 * the Vercel-set x-vercel-ip-country header. Used by the UpsellModal to
 * show the right pack price; the checkout route ALSO recomputes from the
 * request headers and rejects any mismatch (defence in depth).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const geo = geoFromHeaders(req.headers);
  return NextResponse.json({
    country: geo.country,
    countryName: countryName(geo.country),
    currency: geo.currency,
    detected: geo.detected,
  });
}
