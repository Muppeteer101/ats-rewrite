'use client';

import Link from 'next/link';

export interface RewriteRef {
  id: string;
  jobTitle: string;
  date: number;
  scoreBefore: number;
  scoreAfter: number;
  pdfTemplate: string;
}

/**
 * Client component so the PDF link's onClick (stopPropagation) is valid.
 * Uses an overlay <Link> pattern to avoid nested <a> tags (invalid HTML).
 */
export function RewriteList({ rewrites }: { rewrites: RewriteRef[] }) {
  return (
    <div className="card-elevated divide-y divide-[var(--color-border)]">
      {rewrites.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-4 p-4 hover:bg-[var(--color-surface-soft)] transition-colors relative"
        >
          {/* Full-row link — positioned behind the PDF button (z-0) */}
          <Link
            href={`/rewrite/${r.id}`}
            className="absolute inset-0 z-0"
            aria-label={`Open rewrite: ${r.jobTitle}`}
          />

          <div className="flex-1 min-w-0 relative z-10 pointer-events-none">
            <div className="text-[15px]" style={{ color: 'var(--color-heading)', fontWeight: 400 }}>
              {r.jobTitle}
            </div>
            <div className="caption mt-0.5">
              {new Date(r.date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}{' '}
              · {r.pdfTemplate}
            </div>
          </div>

          <div className="text-sm flex items-center gap-2 relative z-10 pointer-events-none">
            <span className="tabular" style={{ color: 'var(--color-body)' }}>
              {r.scoreBefore}
            </span>
            <span style={{ color: 'var(--color-border-soft-purple)' }}>→</span>
            <span
              className="tabular"
              style={{ color: 'var(--color-success-text)', fontWeight: 400 }}
            >
              {r.scoreAfter}
            </span>
          </div>

          {/* PDF link sits above the overlay link (z-10) so it captures its own clicks */}
          <a
            href={`/api/pdf/${r.id}?template=${r.pdfTemplate}`}
            className="caption hover:text-[var(--color-purple)] underline decoration-dotted relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            PDF
          </a>
        </div>
      ))}
    </div>
  );
}
