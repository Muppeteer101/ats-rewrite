import { callJson, MODELS } from '../llm';
import { CV_SYSTEM } from '../prompts';
import { cvAnalysisSchema, type CVAnalysis } from '../schemas';

/**
 * Pass 2 — CV analysis.
 * Sonnet @ temp 0.1. Can run in parallel with Pass 1.
 * Target latency: ≤15s.
 */
export async function analyzeCV(cvText: string): Promise<CVAnalysis> {
  const user =
    `CV:\n\n${cvText.slice(0, 16000)}\n\n` +
    `Return JSON conforming to the CVAnalysis schema:\n` +
    `{\n` +
    `  "candidate_seniority": "intern"|"junior"|"mid"|"senior"|"lead"|"principal"|"executive",\n` +
    `  "years_experience": number,\n` +
    `  "contact": { "name": string, "email"?: string, "phone"?: string, "location"?: string, "links"?: string[] },\n` +
    `  "summary"?: string,\n` +
    `  "roles": [{ "title": string, "company": string, "dates": string, "responsibilities": string[], "achievements": [{ "text": string, "has_metric": boolean }] }],\n` +
    `  "stated_skills": string[],\n` +
    `  "implied_skills": string[],\n` +
    `  "education"?: [{ "institution": string, "qualification": string, "dates"?: string }],\n` +
    `  "certifications"?: string[],\n` +
    `  "voice_signature": { "formality": 0-10, "verbosity": 0-10, "first_person": boolean }\n` +
    `}`;

  return callJson({
    model: MODELS.sonnet,    // kept on Sonnet — cleaner JSON output, no parser flakiness
    system: CV_SYSTEM,
    user,
    schema: cvAnalysisSchema,
    temperature: 0.1,
    maxTokens: 4096,         // back to the safe original
  });
}
