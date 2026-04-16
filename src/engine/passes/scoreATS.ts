import { callJson, MODELS } from '../llm';
import { SCORE_SYSTEM } from '../prompts';
import {
  atsScoreSchema,
  type ATSScore,
  type JDAnalysis,
  type RewriteOutput,
} from '../schemas';

/**
 * Pass 4 — ATS scoring + honest gap report.
 * Haiku @ temp 0 (pure rubric-driven scoring, cheap, fast).
 * Target latency: ≤15s.
 */
export async function scoreATS(opts: {
  jdAnalysis: JDAnalysis;
  rewrite: RewriteOutput;
}): Promise<ATSScore> {
  const { jdAnalysis, rewrite } = opts;

  const user = [
    'JD ANALYSIS:',
    JSON.stringify(jdAnalysis, null, 2),
    '',
    'REWRITTEN CV:',
    JSON.stringify(rewrite, null, 2),
    '',
    'Return JSON conforming to the ATSScore schema:',
    '{',
    '  "before_score": 0-100,',
    '  "after_score": 0-100,',
    '  "keyword_coverage": { "required": "n/total", "preferred": "n/total" },',
    '  "matched_keywords": string[],',
    '  "missing_keywords": string[],',
    '  "strengthened_areas": string[],',
    '  "honest_gap_report": string,',
    '  "format_warnings"?: string[]',
    '}',
  ].join('\n');

  return callJson({
    model: MODELS.haiku,
    system: SCORE_SYSTEM,
    user,
    schema: atsScoreSchema,
    temperature: 0,
    maxTokens: 1024,
  });
}
