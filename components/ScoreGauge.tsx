'use client';

import { useEffect, useState } from 'react';

/**
 * Animated before → after score gauge. The headline result.
 * Stripe palette: deep navy headings, purple accent, success green for the
 * uplift — multi-layer blue-tinted shadow per DESIGN.md §6.
 */
export function ScoreGauge({ before, after }: { before: number; after: number }) {
  const [shown, setShown] = useState(before);

  useEffect(() => {
    const start = performance.now();
    const duration = 1500;
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(before + (after - before) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [before, after]);

  const delta = after - before;
  return (
    <div className="card-elevated p-7 flex items-center gap-8 flex-wrap">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ color: 'var(--color-body)' }}>
          Before
        </div>
        <div className="tabular" style={{ fontSize: '2.25rem', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--color-body)' }}>
          {before}
        </div>
      </div>
      <div className="text-2xl" style={{ color: 'var(--color-border-soft-purple)' }}>→</div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ color: 'var(--color-purple)' }}>
          After
        </div>
        <div
          className="tabular"
          style={{ fontSize: '3.5rem', fontWeight: 300, letterSpacing: '-0.025em', color: 'var(--color-heading)', lineHeight: 1 }}
        >
          {shown}
        </div>
      </div>
      <div className="ml-auto text-right">
        <div className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ color: 'var(--color-body)' }}>
          Uplift
        </div>
        <div className="tabular flex items-center gap-2" style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--color-success-text)' }}>
          +{delta}
          <span className="badge badge-success">match</span>
        </div>
      </div>
    </div>
  );
}
