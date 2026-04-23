import { callJson, MODELS } from '../llm';
import { PROMPT_3_MATCH } from '../prompts';
import {
  roleMatchSchema,
  type RoleMatch,
  type JobAnalysis,
  type CVAnalysis,
} from '../schemas';

/** Pass 3 — Role Match Score. Haiku @ temp 0 (rubric-driven, cheap). */
export async function runRoleMatch(opts: {
  jobAnalysis: JobAnalysis;
  cvAnalysis: CVAnalysis;
  /** Gaps the candidate confirmed they DO have, even though not on the CV. */
  confirmedGaps?: string[];
}): Promise<RoleMatch> {
  const parts = [
    'JOB ANALYSIS:',
    JSON.stringify(opts.jobAnalysis, null, 2),
    '',
    'CV ANALYSIS:',
    JSON.stringify(opts.cvAnalysis, null, 2),
  ];
  if (opts.confirmedGaps && opts.confirmedGaps.length > 0) {
    parts.push('', 'CONFIRMED-GAP EXPERIENCE (candidate has affirmed they have these, even though not on the CV — treat as EVIDENCED):');
    for (const g of opts.confirmedGaps) parts.push(`- ${g}`);
  }
  const user = parts.join('\n');

  return callJson({
    model: MODELS.haiku,
    system: PROMPT_3_MATCH,
    user,
    schema: roleMatchSchema,
    temperature: 0,
    maxTokens: 3500,
  });
}
