'use client';

import { useEffect, useState } from 'react';
import { PACKS } from '@/lib/stripe';
import { SUPPORTED_CURRENCIES, type Currency } from '@/lib/fx';

export function UpsellModal({ onClose }: { onClose?: () => void }) {
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [busy, setBusy] = useState<3 | 10 | null>(null);

  useEffect(() => {
    try {
      const locale = navigator.language.toUpperCase();
      if (locale.endsWith('US')) setCurrency('USD');
      else if (locale.endsWith('AU')) setCurrency('AUD');
      else if (locale.endsWith('CA')) setCurrency('CAD');
      else if (locale.endsWith('NZ')) setCurrency('NZD');
      else if (
        locale.startsWith('DE') ||
        locale.startsWith('FR') ||
        locale.startsWith('ES') ||
        locale.startsWith('IT') ||
        locale.startsWith('NL')
      ) {
        setCurrency('EUR');
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function buy(pack: 3 | 10) {
    setBusy(pack);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pack, currency }),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13, 37, 61, 0.45)' }}>
      <div className="card-elevated max-w-lg w-full p-7">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="sub-heading mb-1">You’re out of credits</h2>
            <p className="caption">Top up to keep tailoring CVs to specific roles.</p>
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

        <div className="mb-5">
          <label className="text-[11px] uppercase tracking-[0.14em] block mb-2" style={{ color: 'var(--color-body)' }}>
            Currency
          </label>
          <div className="flex gap-1 flex-wrap">
            {SUPPORTED_CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className="text-xs px-3 py-1.5 rounded-[4px] border transition-colors"
                style={
                  currency === c
                    ? {
                        borderColor: 'var(--color-purple)',
                        background: 'var(--color-purple-soft)',
                        color: 'var(--color-purple)',
                      }
                    : {
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-body)',
                        background: 'white',
                      }
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PACKS.map((p) => (
            <button
              key={p.pack}
              type="button"
              onClick={() => buy(p.pack)}
              disabled={busy !== null}
              className="text-left p-5 rounded-[6px] border transition-colors disabled:opacity-50"
              style={{
                borderColor: p.highlight ? 'var(--color-purple)' : 'var(--color-border)',
                background: p.highlight ? 'var(--color-purple-soft)' : 'white',
              }}
            >
              {p.highlight && (
                <span className="badge badge-purple mb-2">Best value</span>
              )}
              <div className="tabular" style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--color-heading)' }}>
                {p.credits} rewrites
              </div>
              <div
                className="tabular my-2"
                style={{ fontSize: '2rem', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--color-purple)' }}
              >
                {p.total[currency]}
              </div>
              <div className="caption">{p.perCredit[currency]} per rewrite</div>
              {busy === p.pack && (
                <div className="caption mt-2">Redirecting…</div>
              )}
            </button>
          ))}
        </div>
        <p className="caption mt-5 text-center">
          Secure payment via Stripe. No subscription. Credits never expire.
        </p>
      </div>
    </div>
  );
}
