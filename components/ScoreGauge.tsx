'use client';

import { useEffect, useState } from 'react';

/**
 * Animated before → after score gauge. The headline result. This is the
 * frame that goes in the LinkedIn ad screenshots — keep it bold.
 */
export function ScoreGauge({ before, after }: { before: number; after: number }) {
  const [shown, setShown] = useState(before);

  useEffect(() => {
    const start = performance.now();
    const duration = 1500;
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(before + (after - before) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [before, after]);

  const delta = after - before;
  return (
    <div className="card p-6 flex items-center gap-8">
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--color-fg-dim)] mb-1">Before</div>
        <div className="text-4xl font-bold text-[var(--color-fg-muted)]">{before}</div>
      </div>
      <div className="text-2xl text-[var(--color-fg-dim)]">→</div>
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--color-accent-2)] mb-1">After</div>
        <div className="text-6xl font-bold text-[var(--color-accent-2)] tabular-nums">{shown}</div>
      </div>
      <div className="ml-auto text-right">
        <div className="text-xs uppercase tracking-wider text-[var(--color-fg-dim)] mb-1">Uplift</div>
        <div className="text-2xl font-bold text-[var(--color-accent)]">+{delta}</div>
      </div>
    </div>
  );
}
