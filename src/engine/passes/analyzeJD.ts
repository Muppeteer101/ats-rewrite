import { callJson, MODELS } from '../llm';
import { JD_SYSTEM } from '../prompts';
import { jdAnalysisSchema, type JDAnalysis } from '../schemas';

/**
 * Pass 1 — JD analysis.
 * Sonnet @ temp 0.1 (deterministic extraction, not generation).
 * Target latency: ≤15s.
 */
export async function analyzeJD(jdText: string): Promise<JDAnalysis> {
  const user =
    `JOB DESCRIPTION:\n\n${jdText.slice(0, 6000)}\n\n` +
    `Return JSON conforming to:\n` +
    `{\n` +
    `  "role_title": string,\n` +
    `  "seniority": "intern"|"junior"|"mid"|"senior"|"lead"|"principal"|"executive",\n` +
    `  "required_skills": string[],\n` +
    `  "preferred_skills": string[],\n` +
    `  "domain_keywords": string[],\n` +
    `  "soft_signals": string[],\n` +
    `  "deal_breakers": string[],\n` +
    `  "seniority_signals": string[],\n` +
    `  "company_tone": "formal"|"startup-casual"|"academic"|"corporate"|"mixed"\n` +
    `}`;

  return callJson({
    model: MODELS.sonnet,    // kept on Sonnet — cleaner JSON output, no parser flakiness
    system: JD_SYSTEM,
    user,
    schema: jdAnalysisSchema,
    temperature: 0.1,
    maxTokens: 1500,         // tightened from 2048
  });
}
