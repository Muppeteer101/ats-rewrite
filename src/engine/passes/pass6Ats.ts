import { callJson, MODELS } from '../llm';
import { PROMPT_6_ATS } from '../prompts';
import {
  atsConfidenceSchema,
  type ATSConfidence,
  type JobAnalysis,
  type RewriteOutput,
} from '../schemas';

/** Pass 6 — ATS Confidence Rating. Haiku @ temp 0 (rubric-driven). */
export async function runAtsConfidence(opts: {
  rewrittenCV: RewriteOutput;
  jobAnalysis: JobAnalysis;
}): Promise<ATSConfidence> {
  const user = [
    'REWRITTEN CV:',
    JSON.stringify(opts.rewrittenCV, null, 2),
    '',
    'JOB ANALYSIS:',
    JSON.stringify(opts.jobAnalysis, null, 2),
  ].join('\n');

  return callJson({
    model: MODELS.haiku,
    system: PROMPT_6_ATS,
    user,
    schema: atsConfidenceSchema,
    temperature: 0,
    maxTokens: 2500,
  });
}
