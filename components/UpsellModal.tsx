'use client';

import { useEffect, useState } from 'react';
import { PACKS } from '@/lib/stripe';
import type { Currency } from '@/lib/fx';

type GeoResponse = {
  country: string | null;
  countryName: string;
  currency: Currency;
  detected: boolean;
};

/**
 * Out-of-credits top-up modal.
 *
 * `resumeDraftId` — if set, passes through to /api/checkout so that after a
 * successful top-up Stripe returns the user to /rewrite/<draftId>?topup=success
 * instead of the dashboard. That page sees the query param and re-runs the
 * rewrite with the sessionStorage payload, so the flow feels continuous
 * instead of "pay, land on dashboard, go back to start, re-upload everything".
 */
export function UpsellModal({
  onClose,
  resumeDraftId,
}: {
  onClose?: () => void;
  resumeDraftId?: string;
}) {
  const [geo, setGeo] = useState<GeoResponse | null>(null);
  const [busy, setBusy] = useState<3 | 10 | null>(null);

  // Currency is locked to the user's geo-IP — not a UI choice — so a UK
  // user can't pick USD to save 15% on FX. Server enforces too.
  useEffect(() => {
    fetch('/api/geo')
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => setGeo({ country: null, countryName: 'your region', currency: 'USD', detected: false }));
  }, []);

  async function buy(pack: 3 | 10) {
    if (!geo) return;
    setBusy(pack);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pack, resumeDraftId }),     // currency derived server-side from geo, not sent
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Could not start checkout');
      }
      location.href = data.url;
    } catch (e) {
      alert((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(13, 37, 61, 0.45)' }}
    >
      <div className="card-elevated max-w-lg w-full p-7">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="sub-heading mb-1">You’re out of credits</h2>
            <p className="caption">Top up to keep tailoring resumes to specific roles.</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-2xl leading-none px-2"
              style={{ color: 'var(--color-body)' }}
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        {/* Geo notice — replaces the old user-picked currency chips */}
        {geo && (
          <div
            className="mb-5 p-3 rounded-[6px] border flex items-start gap-2 text-sm"
            style={{
              background: 'var(--color-purple-soft)',
              borderColor: 'var(--color-border-soft-purple)',
              color: 'var(--color-heading)',
            }}
          >
            <span style={{ color: 'var(--color-purple)' }}>●</span>
            <span className="leading-snug">
              Pricing in <strong>{geo.currency}</strong>{' '}
              {geo.detected && (
                <span style={{ color: 'var(--color-body)' }}>
                  — detected from {geo.countryName}.
                </span>
              )}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {PACKS.map((p) => {
            const currency = geo?.currency ?? 'USD';
            return (
              <button
                key={p.pack}
                type="button"
                onClick={() => buy(p.pack)}
                disabled={busy !== null || !geo}
                className="text-left p-5 rounded-[6px] border transition-colors disabled:opacity-50"
                style={{
                  borderColor: p.highlight ? 'var(--color-purple)' : 'var(--color-border)',
                  background: p.highlight ? 'var(--color-purple-soft)' : 'white',
                }}
              >
                {p.highlight && <span className="badge badge-purple mb-2">Best value</span>}
                <div
                  className="tabular"
                  style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--color-heading)' }}
                >
                  {p.credits} rewrites
                </div>
                <div
                  className="tabular my-2"
                  style={{
                    fontSize: '2rem',
                    fontWeight: 300,
                    letterSpacing: '-0.02em',
                    color: 'var(--color-purple)',
                  }}
                >
                  {p.total[currency]}
                </div>
                <div className="caption">{p.perCredit[currency]} per rewrite</div>
                {busy === p.pack && <div className="caption mt-2">Redirecting…</div>}
              </button>
            );
          })}
        </div>
        <p className="caption mt-5 text-center">
          Secure payment via Stripe. No subscription. Credits never expire.
        </p>
      </div>
    </div>
  );
}
