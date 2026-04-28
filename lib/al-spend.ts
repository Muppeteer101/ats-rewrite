import { jwtVerify } from 'jose';

/**
 * Verify a one-time spend token issued by https://almostlegal.ai/spend.
 *
 * The Almost Legal hub is the only thing that signs these tokens — every
 * brand site (this one included) is a stateless tool that redirects to AL,
 * lets AL atomically debit a credit and sign a 5-minute JWT, then verifies
 * the JWT here before doing the actual paid work.
 *
 * Shared secret: AL_SPEND_HMAC_SECRET (HS256). Same value on AL and here.
 */

const ISSUER = 'almostlegal.ai';

export type SpendPayload = {
  /** Clerk user ID (on AL). */
  sub: string;
  /** Clerk primary email — useful for the "rewrite ready" email. */
  email: string;
  /** Brand product slug — must match this brand's slug. */
  product: string;
  /** 'paid' (a credit was decremented) or 'free-monthly' (IMR's free tier). */
  source: 'paid' | 'free-monthly';
  /** One-time token id — store on first use to prevent replay within the 5-min window. */
  jti: string;
};

function getSecret(): Uint8Array {
  const raw = process.env.AL_SPEND_HMAC_SECRET?.trim();
  if (!raw) throw new Error('AL_SPEND_HMAC_SECRET is not set');
  return new TextEncoder().encode(raw);
}

/**
 * Verify the JWT was signed by AL with the shared secret, hasn't expired,
 * and is for THIS product. Throws on any failure — caller returns 401.
 */
export async function verifySpendToken(token: string, expectedProduct: string): Promise<SpendPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    algorithms: ['HS256'],
  });

  if (
    typeof payload.sub !== 'string' ||
    typeof (payload as Record<string, unknown>).email !== 'string' ||
    typeof (payload as Record<string, unknown>).product !== 'string' ||
    typeof (payload as Record<string, unknown>).source !== 'string' ||
    typeof payload.jti !== 'string'
  ) {
    throw new Error('Malformed spend token payload');
  }

  const product = (payload as Record<string, string>).product;
  if (product !== expectedProduct) {
    throw new Error(`Token is for product "${product}", not "${expectedProduct}"`);
  }

  return {
    sub: payload.sub,
    email: (payload as Record<string, string>).email,
    product,
    source: (payload as Record<string, string>).source as 'paid' | 'free-monthly',
    jti: payload.jti,
  };
}

/** Build the URL that sends the user to AL to spend a credit on this product. */
export function buildSpendRedirect(returnUrl: string): string {
  const params = new URLSearchParams({
    product: 'improvemyresume',
    return: returnUrl,
  });
  return `https://almostlegal.ai/spend?${params.toString()}`;
}
