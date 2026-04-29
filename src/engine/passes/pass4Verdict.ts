import { callJson, MODELS } from '../llm';
import { PROMPT_4_VERDICT } from '../prompts';
import {
  recruiterVerdictSchema,
  type RecruiterVerdict,
  type JobAnalysis,
  type CVAnalysis,
  type RoleMatch,
} from '../schemas';

function todayLine(): string {
  const d = new Date();
  const month = d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `Today's date: ${d.getUTCDate()} ${month} ${d.getUTCFullYear()}. When a role end date is "Present" / "Current", treat it as today's date.`;
}

/** Pass 4 — Recruiter Verdict. Sonnet @ temp 0.3 (voice matters).
 *
 * Confirmed-gap evidence (from rescore) is folded into `cvAnalysis.confirmedAdditionalEvidence`
 * by the caller, not passed separately — the verdict reasons over augmented
 * evidence using the same prompt. */
export async function runRecruiterVerdict(opts: {
  jobAnalysis: JobAnalysis;
  cvAnalysis: CVAnalysis;
  roleMatch: RoleMatch;
}): Promise<RecruiterVerdict> {
  const user = [
    todayLine(),
    '',
    'JOB ANALYSIS:',
    JSON.stringify(opts.jobAnalysis, null, 2),
    '',
    'CV ANALYSIS:',
    JSON.stringify(opts.cvAnalysis, null, 2),
    '',
    'ROLE MATCH SCORE:',
    JSON.stringify(opts.roleMatch, null, 2),
  ].join('\n');

  return callJson({
    model: MODELS.sonnet,
    system: PROMPT_4_VERDICT,
    user,
    schema: recruiterVerdictSchema,
    temperature: 0.3,
    maxTokens: 2000,
  });
}
