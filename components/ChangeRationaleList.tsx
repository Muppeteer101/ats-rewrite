'use client';

import { useState } from 'react';
import type { RewriteOutput } from '@/src/engine/schemas';

export function ChangeRationaleList({ rewrite }: { rewrite: RewriteOutput }) {
  const [expanded, setExpanded] = useState(true);
  const totalBullets = rewrite.roles.reduce((n, r) => n + r.bullets.length, 0);

  return (
    <div className="card-elevated p-7">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>
          <h3 className="sub-heading mb-1">Change report</h3>
          <p className="caption">
            Every line we rewrote and why · {totalBullets} bullet{totalBullets === 1 ? '' : 's'} reframed
          </p>
        </div>
        <span className="text-xl tabular" style={{ color: 'var(--color-purple)' }}>
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <div className="mt-7 space-y-7">
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
              <div className="text-[11px] uppercase tracking-[0.14em] mb-3" style={{ color: 'var(--color-purple)' }}>
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
    <div className="border border-[var(--color-border)] rounded-[6px] p-4 hover:border-[var(--color-border-soft-purple)] transition-colors">
      {role && (
        <div className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--color-body)' }}>
          {role}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--color-body)' }}>
            Before
          </div>
          <p style={{ color: 'var(--color-body)', lineHeight: 1.55 }}>{before || '(empty)'}</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--color-purple)' }}>
            After
          </div>
          <p style={{ color: 'var(--color-heading)', lineHeight: 1.55 }}>{after}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--color-border)] caption">
        <span style={{ color: 'var(--color-heading)', fontWeight: 400 }}>Why: </span>
        {reason}
      </div>
    </div>
  );
}
