'use client';

import { useState } from 'react';
import type { RewriteOutput } from '@/src/engine/schemas';

/**
 * Per-bullet change rationale — every rewrite includes a one-sentence
 * "why this changed" explanation. This is the feature competitors don't
 * have, per ats-engine-architecture.md §6.
 */
export function ChangeRationaleList({ rewrite }: { rewrite: RewriteOutput }) {
  const [expanded, setExpanded] = useState(true);
  const totalBullets = rewrite.roles.reduce((n, r) => n + r.bullets.length, 0);

  return (
    <div className="card p-6">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>
          <h3 className="text-lg font-semibold mb-0.5">Change report</h3>
          <p className="text-xs text-[var(--color-fg-muted)]">
            Every line we rewrote and why. {totalBullets} bullet
            {totalBullets === 1 ? '' : 's'} reframed.
          </p>
        </div>
        <span className="text-[var(--color-fg-muted)]">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="mt-6 space-y-6">
          {rewrite.summary && (
            <BulletDiff
              role="Professional summary"
              before={rewrite.summary.before}
              after={rewrite.summary.after}
              reason={rewrite.summary.reason}
            />
          )}

          {rewrite.roles.map((role) => (
            <div key={`${role.title}-${role.dates}`}>
              <div className="text-xs uppercase tracking-wider text-[var(--color-accent)] mb-3">
                {role.title} · {role.company} · {role.dates}
              </div>
              <div className="space-y-3">
                {role.bullets.map((b, i) => (
                  <BulletDiff key={i} before={b.before} after={b.after} reason={b.reason} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BulletDiff({
  role,
  before,
  after,
  reason,
}: {
  role?: string;
  before: string;
  after: string;
  reason: string;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-fg-dim)] transition-colors">
      {role && (
        <div className="text-xs uppercase tracking-wider text-[var(--color-fg-dim)] mb-2">{role}</div>
      )}
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)] mb-1">
            Before
          </div>
          <p className="text-[var(--color-fg-muted)] leading-relaxed">{before || '(empty)'}</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-accent-2)] mb-1">
            After
          </div>
          <p className="text-[var(--color-fg)] leading-relaxed">{after}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-fg-muted)]">
        <strong className="text-[var(--color-fg)]">Why:</strong> {reason}
      </div>
    </div>
  );
}
