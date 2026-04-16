import type { ATSScore } from '@/src/engine/schemas';

/**
 * The honest gap report. Calls out what the candidate still can't claim —
 * the differentiator vs ChatGPT. Stripe styling: light card, ruby accent
 * on the left edge to flag attention without being alarming.
 */
export function GapReportCard({
  score,
  unmetRequirements,
}: {
  score: ATSScore;
  unmetRequirements: string[];
}) {
  return (
    <div className="card-elevated p-7" style={{ borderLeft: '3px solid var(--color-ruby)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="badge" style={{ background: 'rgba(234,34,97,0.08)', color: 'var(--color-ruby)', borderColor: 'rgba(234,34,97,0.3)' }}>
          Honest gap report
        </span>
      </div>
      <p className="body-large mb-5" style={{ color: 'var(--color-heading)' }}>
        {score.honest_gap_report}
      </p>

      <div className="grid md:grid-cols-2 gap-6 pt-5 border-t border-[var(--color-border)]">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--color-body)' }}>
            Coverage
          </div>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-baseline justify-between">
              <span style={{ color: 'var(--color-body)' }}>Required keywords</span>
              <span className="font-mono tabular" style={{ color: 'var(--color-heading)' }}>
                {score.keyword_coverage.required}
              </span>
            </li>
            <li className="flex items-baseline justify-between">
              <span style={{ color: 'var(--color-body)' }}>Preferred keywords</span>
              <span className="font-mono tabular" style={{ color: 'var(--color-heading)' }}>
                {score.keyword_coverage.preferred}
              </span>
            </li>
          </ul>
        </div>
        {unmetRequirements.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--color-body)' }}>
              What your CV still can’t claim
            </div>
            <ul className="space-y-1 text-sm">
              {unmetRequirements.slice(0, 8).map((u) => (
                <li key={u} style={{ color: 'var(--color-ruby)' }}>
                  · {u}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {score.format_warnings && score.format_warnings.length > 0 && (
        <div className="mt-5 caption" style={{ color: 'var(--color-warn-text)' }}>
          <strong>Format warnings:</strong> {score.format_warnings.join('; ')}
        </div>
      )}
    </div>
  );
}
