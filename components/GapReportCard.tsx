import type { ATSScore } from '@/src/engine/schemas';

/**
 * The honest gap report. The differentiator. Calls out what the candidate
 * still can't claim — opposite of what ChatGPT does.
 */
export function GapReportCard({
  score,
  unmetRequirements,
}: {
  score: ATSScore;
  unmetRequirements: string[];
}) {
  return (
    <div className="card p-6 border-l-4 border-l-[var(--color-warn)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-warn)]">
          Honest gap report
        </span>
      </div>
      <p className="text-base mb-4 leading-relaxed">{score.honest_gap_report}</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--color-fg-dim)] mb-2">
            Coverage
          </div>
          <ul className="text-sm space-y-1 text-[var(--color-fg-muted)]">
            <li>
              Required keywords:{' '}
              <span className="text-[var(--color-fg)] font-mono">{score.keyword_coverage.required}</span>
            </li>
            <li>
              Preferred keywords:{' '}
              <span className="text-[var(--color-fg)] font-mono">{score.keyword_coverage.preferred}</span>
            </li>
          </ul>
        </div>
        {unmetRequirements.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--color-fg-dim)] mb-2">
              What your CV still can’t claim
            </div>
            <ul className="text-sm space-y-1">
              {unmetRequirements.slice(0, 8).map((u) => (
                <li key={u} className="text-[var(--color-warn)]">
                  • {u}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {score.format_warnings && score.format_warnings.length > 0 && (
        <div className="mt-4 text-xs text-[var(--color-warn)]">
          <strong>Format warnings:</strong> {score.format_warnings.join('; ')}
        </div>
      )}
    </div>
  );
}
