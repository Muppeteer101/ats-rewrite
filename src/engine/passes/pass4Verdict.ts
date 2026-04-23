import { callJson, MODELS } from '../llm';
import { PROMPT_4_VERDICT } from '../prompts';
import {
  recruiterVerdictSchema,
  type RecruiterVerdict,
  type JobAnalysis,
  type CVAnalysis,
  type RoleMatch,
} from '../schemas';

/** Pass 4 — Recruiter Verdict. Sonnet @ temp 0.3 (voice matters). */
export async function runRecruiterVerdict(opts: {
  jobAnalysis: JobAnalysis;
  cvAnalysis: CVAnalysis;
  roleMatch: RoleMatch;
  confirmedGaps?: string[];
}): Promise<RecruiterVerdict> {
  const parts = [
    'JOB ANALYSIS:',
    JSON.stringify(opts.jobAnalysis, null, 2),
    '',
    'CV ANALYSIS:',
    JSON.stringify(opts.cvAnalysis, null, 2),
    '',
    'ROLE MATCH SCORE:',
    JSON.stringify(opts.roleMatch, null, 2),
  ];
  if (opts.confirmedGaps && opts.confirmedGaps.length > 0) {
    parts.push('', 'CONFIRMED-GAP EXPERIENCE (candidate has affirmed these, treat as real):');
    for (const g of opts.confirmedGaps) parts.push(`- ${g}`);
  }
  const user = parts.join('\n');

  return callJson({
    model: MODELS.sonnet,
    system: PROMPT_4_VERDICT,
    user,
    schema: recruiterVerdictSchema,
    temperature: 0.3,
    maxTokens: 2000,
  });
}
