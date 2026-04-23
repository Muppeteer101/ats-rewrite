import { callJson, MODELS } from '../llm';
import { PROMPT_6_ATS } from '../prompts';
import {
  atsConfidenceSchema,
  type ATSConfidence,
  type JobAnalysis,
  type RewriteOutput,
} from '../schemas';

/**
 * Pass 6 — ATS Confidence Rating. Haiku @ temp 0 (rubric-driven).
 *
 * Accepts either the ORIGINAL CV (raw text) for the baseline pre-rewrite
 * score, or a REWRITTEN CV (structured object) for the final post-rewrite
 * score. The prompt itself branches on the `mode` signal.
 */
export async function runAtsConfidence(opts: {
  mode: 'original' | 'rewritten';
  originalCv?: string;
  rewrittenCV?: RewriteOutput;
  jobAnalysis: JobAnalysis;
  confirmedGaps?: string[];
}): Promise<ATSConfidence> {
  const parts: string[] = [];

  if (opts.mode === 'original') {
    if (!opts.originalCv) throw new Error('Pass 6 original mode requires originalCv');
    parts.push('MODE: ORIGINAL CV (baseline — before any rewrite)');
    parts.push('');
    parts.push('CV (raw text):');
    parts.push(opts.originalCv.slice(0, 16000));
  } else {
    if (!opts.rewrittenCV) throw new Error('Pass 6 rewritten mode requires rewrittenCV');
    parts.push('MODE: REWRITTEN CV (final — about to be submitted)');
    parts.push('');
    parts.push('REWRITTEN CV:');
    parts.push(JSON.stringify(opts.rewrittenCV, null, 2));
  }

  parts.push('', 'JOB ANALYSIS:', JSON.stringify(opts.jobAnalysis, null, 2));

  if (opts.confirmedGaps && opts.confirmedGaps.length > 0) {
    parts.push('', 'CONFIRMED-GAP EXPERIENCE (treat as present when scoring keyword match):');
    for (const g of opts.confirmedGaps) parts.push(`- ${g}`);
  }

  return callJson({
    model: MODELS.haiku,
    system: PROMPT_6_ATS,
    user: parts.join('\n'),
    schema: atsConfidenceSchema,
    temperature: 0,
    maxTokens: 2500,
  });
}
