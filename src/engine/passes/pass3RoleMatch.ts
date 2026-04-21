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
}): Promise<RoleMatch> {
  const user = [
    'JOB ANALYSIS:',
    JSON.stringify(opts.jobAnalysis, null, 2),
    '',
    'CV ANALYSIS:',
    JSON.stringify(opts.cvAnalysis, null, 2),
  ].join('\n');

  return callJson({
    model: MODELS.haiku,
    system: PROMPT_3_MATCH,
    user,
    schema: roleMatchSchema,
    temperature: 0,
    maxTokens: 2500,
  });
}
