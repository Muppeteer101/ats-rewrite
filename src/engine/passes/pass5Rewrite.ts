import { callJson, MODELS } from '../llm';
import { PROMPT_5_REWRITE } from '../prompts';
import {
  rewritePass5Schema,
  type RewritePass5,
  type JobAnalysis,
  type RoleMatch,
  type RecruiterVerdict,
} from '../schemas';

/**
 * Pass 5 — the actual rewrite. Sonnet @ temp 0.4 (creative within tight
 * anti-fabrication constraints). Emits {rewrittenCV, coverLetter, changesMade}
 * in a single call so the three artefacts share a coherent view of the CV.
 *
 * This is the most token-hungry pass — maxTokens sized to comfortably fit a
 * senior-level CV rewrite plus a cover letter plus the changes list. If the
 * user has a very long CV (2+ pages of dense roles) and gets truncated JSON,
 * the Zod validation will fail and the engine will surface a clear error.
 */
export async function runRewrite(opts: {
  originalCv: string;
  jobAnalysis: JobAnalysis;
  roleMatch: RoleMatch;
  recruiterVerdict: RecruiterVerdict;
}): Promise<RewritePass5> {
  const user = [
    'ORIGINAL CV (verbatim — do not invent anything beyond this):',
    opts.originalCv.slice(0, 16000),
    '',
    'JOB ANALYSIS:',
    JSON.stringify(opts.jobAnalysis, null, 2),
    '',
    'ROLE MATCH SCORE (for context on strengths + gaps):',
    JSON.stringify(opts.roleMatch, null, 2),
    '',
    'RECRUITER VERDICT (whatWouldChangeIt tells you what the rewrite should address):',
    JSON.stringify(opts.recruiterVerdict, null, 2),
  ].join('\n');

  return callJson({
    model: MODELS.sonnet,
    system: PROMPT_5_REWRITE,
    user,
    schema: rewritePass5Schema,
    temperature: 0.4,
    maxTokens: 8000,
  });
}
