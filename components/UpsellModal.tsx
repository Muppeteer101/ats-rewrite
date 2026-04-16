'use client';

import { useEffect, useState } from 'react';
import { PACKS } from '@/lib/stripe';
import { SUPPORTED_CURRENCIES, type Currency } from '@/lib/fx';

/**
 * Shown when /api/rewrite returns 402 (out of credits) — or from the
 * dashboard's "Get more credits" button. Two packs, multi-currency picker.
 */
export function UpsellModal({ onClose }: { onClose?: () => void }) {
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [busy, setBusy] = useState<3 | 10 | null>(null);

  // Best-effort default currency from browser locale.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card max-w-lg w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">You’re out of credits</h2>
            <p className="text-sm text-[var(--color-fg-muted)]">
              Top up to keep tailoring CVs to specific roles.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        <div className="mb-4">
          <label className="text-xs uppercase tracking-wider text-[var(--color-fg-dim)] block mb-2">
            Currency
          </label>
          <div className="flex gap-1 flex-wrap">
            {SUPPORTED_CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`text-xs px-3 py-1.5 rounded border ${
                  currency === c
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-fg)]'
                    : 'border-[var(--color-border)] text-[var(--color-fg-muted)]'
                }`}
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
              className={`text-left p-4 rounded-lg border transition-colors disabled:opacity-50 ${
                p.highlight
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              {p.highlight && (
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-accent)] font-semibold mb-1">
                  Best value
                </div>
              )}
              <div className="text-2xl font-bold mb-0.5">{p.credits} rewrites</div>
              <div className="text-3xl font-bold text-[var(--color-accent)] mb-1">
                {p.total[currency]}
              </div>
              <div className="text-xs text-[var(--color-fg-muted)]">
                {p.perCredit[currency]} per rewrite
              </div>
              {busy === p.pack && (
                <div className="text-xs text-[var(--color-fg-muted)] mt-2">Redirecting…</div>
              )}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[var(--color-fg-dim)] mt-4 text-center">
          Secure payment via Stripe. No subscription. Credits never expire.
        </p>
      </div>
    </div>
  );
}
