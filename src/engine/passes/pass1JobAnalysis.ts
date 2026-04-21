import { callJson, MODELS } from '../llm';
import { PROMPT_1_JOB } from '../prompts';
import { jobAnalysisSchema, type JobAnalysis } from '../schemas';

/** Pass 1 — Job Analysis. Sonnet @ temp 0.1 (extraction, not generation). */
export async function runJobAnalysis(jdText: string): Promise<JobAnalysis> {
  return callJson({
    model: MODELS.sonnet,
    system: PROMPT_1_JOB,
    user: `JOB DESCRIPTION:\n\n${jdText.slice(0, 12000)}`,
    schema: jobAnalysisSchema,
    temperature: 0.1,
    maxTokens: 3000,
  });
}
