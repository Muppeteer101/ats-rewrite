import { callJson, MODELS } from '../llm';
import { PROMPT_2_CV } from '../prompts';
import { cvAnalysisSchema, type CVAnalysis } from '../schemas';

function todayLine(): string {
  const d = new Date();
  const month = d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `Today's date: ${d.getUTCDate()} ${month} ${d.getUTCFullYear()}. When a role end date is "Present" / "Current", treat it as today's date when computing tenure.`;
}

/** Pass 2 — CV Analysis. Sonnet @ temp 0.1. Honest assessment, not flattery. */
export async function runCvAnalysis(cvText: string): Promise<CVAnalysis> {
  return callJson({
    model: MODELS.sonnet,
    system: PROMPT_2_CV,
    user: `${todayLine()}\n\nCV:\n\n${cvText.slice(0, 16000)}`,
    schema: cvAnalysisSchema,
    temperature: 0.1,
    maxTokens: 4096,
  });
}
