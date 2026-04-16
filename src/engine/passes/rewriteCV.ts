import { streamText, MODELS } from '../llm';
import { REWRITE_SYSTEM } from '../prompts';
import { rewriteOutputSchema, type RewriteOutput, type CVAnalysis, type JDAnalysis } from '../schemas';

/**
 * Pass 3 — Rewrite + change-log.
 * Sonnet @ temp 0.4 (creative within tight constraints).
 * Streamed token-by-token so the UI can show live narration.
 *
 * Returns the final parsed RewriteOutput AND yields the raw text deltas.
 * The orchestrator passes the deltas to the SSE feed for the user.
 */
export async function* rewriteCV(opts: {
  cvText: string;
  jdText: string;
  cvAnalysis: CVAnalysis;
  jdAnalysis: JDAnalysis;
}): AsyncGenerator<string, RewriteOutput, void> {
  const { cvText, jdText, cvAnalysis, jdAnalysis } = opts;

  const user = [
    'CV ANALYSIS:',
    JSON.stringify(cvAnalysis, null, 2),
    '',
    'JD ANALYSIS:',
    JSON.stringify(jdAnalysis, null, 2),
    '',
    'ORIGINAL CV (for voice reference + ground-truth check):',
    cvText.slice(0, 16000),
    '',
    'ORIGINAL JD (for context):',
    jdText.slice(0, 8000),
    '',
    'Return JSON conforming to the RewriteOutput schema:',
    '{',
    '  "contact": { "name": string, "email"?: string, "phone"?: string, "location"?: string, "links"?: string[] },',
    '  "summary": { "before": string, "after": string, "reason": string },',
    '  "roles": [{ "title": string, "company": string, "dates": string, "bullets": [{ "before": string, "after": string, "reason": string }] }],',
    '  "skills": string[],',
    '  "education"?: [{ "institution": string, "qualification": string, "dates"?: string }],',
    '  "certifications"?: string[],',
    '  "unmet_requirements": string[]',
    '}',
    '',
    'Remember: NEVER fabricate. If a JD-required skill is not in the source CV, list it in unmet_requirements.',
  ].join('\n');

  let full = '';
  for await (const delta of streamText({
    model: MODELS.sonnet,
    system: REWRITE_SYSTEM,
    user,
    temperature: 0.4,
    maxTokens: 8192,
  })) {
    full += delta;
    yield delta;
  }

  // Parse the streamed JSON at the end.
  const json = extractJson(full);
  const parsed = rewriteOutputSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Rewrite output failed schema validation: ${parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  return parsed.data;
}

function extractJson(s: string): unknown {
  const trimmed = s.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* try fence */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* try braces */
    }
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new Error('Could not extract JSON from rewrite stream.');
}
