import { callJson, MODELS } from '../llm';
import { COVER_LETTER_SYSTEM } from '../prompts';
import {
  coverLetterSchema,
  type CoverLetter,
  type CVAnalysis,
  type JDAnalysis,
  type RewriteOutput,
} from '../schemas';

/**
 * Pass 5 — Cover letter.
 * Sonnet @ temp 0.5 (slightly more creative than rewrite, still constrained).
 * Target latency: ≤15s.
 */
export async function generateCoverLetter(opts: {
  jdText: string;
  jdAnalysis: JDAnalysis;
  cvAnalysis: CVAnalysis;
  rewrite: RewriteOutput;
}): Promise<CoverLetter> {
  const { jdText, jdAnalysis, cvAnalysis, rewrite } = opts;

  const user = [
    'JD ANALYSIS:',
    JSON.stringify(jdAnalysis, null, 2),
    '',
    'CV VOICE SIGNATURE (preserve this):',
    JSON.stringify(cvAnalysis.voice_signature, null, 2),
    '',
    'REWRITTEN CV (use only what is here — never invent):',
    JSON.stringify(rewrite, null, 2),
    '',
    'ORIGINAL JD (for company name + tone signals):',
    jdText.slice(0, 6000),
    '',
    'Return JSON conforming to:',
    '{',
    '  "greeting": string,',
    '  "paragraphs": string[] (2-5 entries, 180-260 words total),',
    '  "signoff": string,',
    '  "signature": string',
    '}',
  ].join('\n');

  return callJson({
    model: MODELS.sonnet,    // stays on Sonnet for voice quality; cost controlled via maxTokens
    system: COVER_LETTER_SYSTEM,
    user,
    schema: coverLetterSchema,
    temperature: 0.5,
    maxTokens: 1500,         // back to the safe original
  });
}
