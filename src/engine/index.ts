import { analyzeJD } from './passes/analyzeJD';
import { analyzeCV } from './passes/analyzeCV';
import { rewriteCV } from './passes/rewriteCV';
import { scoreATS } from './passes/scoreATS';
import { generateCoverLetter } from './passes/coverLetter';
import type { EngineResult, NarrationEvent, JDAnalysis, CVAnalysis } from './schemas';
import { detectGaps } from './gap-detect';

export type EngineInput = {
  cvText: string;
  jdText: string;
  cvSource: { kind: 'text' | 'pdf' | 'docx' };
  jdSource: { kind: 'text' | 'pdf' | 'docx' | 'url'; url?: string };
  /** Opt-in cover letter (Pass 5). Default false to keep free-tier costs down. */
  includeCoverLetter?: boolean;
  /** Pre-computed Pass 1+2 results from /api/analyze — skips running them again. */
  preAnalysis?: { jdAnalysis: JDAnalysis; cvAnalysis: CVAnalysis };
  /** User-confirmed implied skills from the gap-confirm step. Merged into CV implied_skills. */
  extraSkills?: string[];
};

/**
 * Run all four passes, yielding NarrationEvents the SSE route can stream
 * to the user, and finishing with a 'result' event carrying the rewriteId.
 *
 * The caller is responsible for persisting the EngineResult (returned
 * value of the generator) to Redis under k.rewrite(id).
 */
export async function* runEngine(
  input: EngineInput,
  rewriteId: string,
): AsyncGenerator<NarrationEvent, EngineResult, void> {
  const startedAt = Date.now();

  // Pass 1+2 — use pre-computed analysis if available (from /api/analyze gap-confirm step),
  // otherwise run both in parallel now.
  let jdAnalysis: JDAnalysis;
  let cvAnalysis: CVAnalysis;

  if (input.preAnalysis) {
    jdAnalysis = input.preAnalysis.jdAnalysis;
    cvAnalysis = input.preAnalysis.cvAnalysis;
    yield { type: 'system', line: '› Engine starting — using pre-computed analysis, running Pass 3+4…' };
    yield {
      type: 'pass-complete',
      pass: 1,
      line: `✓ JD: role "${jdAnalysis.role_title}" (${jdAnalysis.seniority}), ${jdAnalysis.required_skills.length} required skills, ${jdAnalysis.preferred_skills.length} preferred, tone is ${jdAnalysis.company_tone}.`,
    };
    yield {
      type: 'pass-complete',
      pass: 2,
      line: `✓ CV: ${cvAnalysis.years_experience} years (${cvAnalysis.candidate_seniority}), ${cvAnalysis.roles.length} roles, ${cvAnalysis.stated_skills.length} stated skills + ${cvAnalysis.implied_skills.length} implied.`,
    };
  } else {
    yield { type: 'system', line: '› Engine starting — running 4 passes…' };
    yield { type: 'pass', pass: 1, line: '[Pass 1] Reading the job description…' };
    yield { type: 'pass', pass: 2, line: '[Pass 2] Analysing your CV…' };

    [jdAnalysis, cvAnalysis] = await Promise.all([
      analyzeJD(input.jdText),
      analyzeCV(input.cvText),
    ]);

    yield {
      type: 'pass-complete',
      pass: 1,
      line: `✓ JD: role "${jdAnalysis.role_title}" (${jdAnalysis.seniority}), ${jdAnalysis.required_skills.length} required skills, ${jdAnalysis.preferred_skills.length} preferred, tone is ${jdAnalysis.company_tone}.`,
    };
    yield {
      type: 'pass-complete',
      pass: 2,
      line: `✓ CV: ${cvAnalysis.years_experience} years (${cvAnalysis.candidate_seniority}), ${cvAnalysis.roles.length} roles, ${cvAnalysis.stated_skills.length} stated skills + ${cvAnalysis.implied_skills.length} implied. Voice: formality ${cvAnalysis.voice_signature.formality}/10, ${cvAnalysis.voice_signature.first_person ? 'first-person' : 'third-person'}.`,
    };

    // Narration-only gap pre-flight (word-level matching, not phrase matching).
    const gaps = detectGaps(jdAnalysis.required_skills, input.cvText, cvAnalysis);
    if (gaps.length > 0) {
      yield {
        type: 'warn',
        line: `ℹ ${gaps.length} JD keyword${gaps.length > 1 ? 's' : ''} not found literally in your CV (${gaps.slice(0, 3).join(', ')}${gaps.length > 3 ? '…' : ''}). Given your experience level, the rewrite will surface these through your actual achievements.`,
      };
    }
  }

  // Merge user-confirmed extra skills into implied_skills for Pass 3.
  if (input.extraSkills?.length) {
    cvAnalysis = {
      ...cvAnalysis,
      implied_skills: [
        ...new Set([...cvAnalysis.implied_skills, ...input.extraSkills]),
      ],
    };
  }

  // Pass 3 — the streamed rewrite.
  yield { type: 'pass', pass: 3, line: '[Pass 3] Rewriting your CV against the JD (streaming)…' };

  const stream = rewriteCV({
    cvText: input.cvText,
    jdText: input.jdText,
    cvAnalysis,
    jdAnalysis,
  });

  let charCount = 0;
  let nextNarration = 250; // emit a "still working" line every 250 chars
  let next: IteratorResult<string, ReturnType<typeof Object>>;
  // We don't actually surface the raw token stream to the user — it's JSON
  // and noisy. Instead we emit periodic "rewriting bullet N/X" style updates.
  // The full result is the generator's return value.
  while (!(next = await stream.next()).done) {
    charCount += next.value.length;
    if (charCount > nextNarration) {
      yield { type: 'pass', pass: 3, line: `  …rewriting (${charCount} chars produced)…` };
      nextNarration = charCount + 800;
    }
  }
  const rewrite = next.value;

  yield {
    type: 'pass-complete',
    pass: 3,
    line: (() => {
      const totalBullets = rewrite.roles.reduce(
        (n: number, r: { bullets: unknown[] }) => n + r.bullets.length,
        0,
      );
      const gaps = rewrite.unmet_requirements.length;
      return `✓ Rewrite complete — ${totalBullets} bullets reframed, ${rewrite.skills.length} skills surfaced, ${gaps} gap${gaps === 1 ? '' : 's'} flagged honestly.`;
    })(),
  };

  // Pass 4 (scoring) always runs. Pass 5 (cover letter) is opt-in.
  yield { type: 'pass', pass: 4, line: '[Pass 4] Scoring against the JD…' };
  if (input.includeCoverLetter) {
    yield { type: 'pass', pass: 4, line: '[Pass 5] Drafting your cover letter…' };
  }

  const [score, coverLetter] = await Promise.all([
    scoreATS({ jdAnalysis, rewrite, impliedSkills: cvAnalysis.implied_skills }),
    input.includeCoverLetter
      ? generateCoverLetter({ jdText: input.jdText, jdAnalysis, cvAnalysis, rewrite })
      : Promise.resolve(undefined),
  ]);

  yield {
    type: 'pass-complete',
    pass: 4,
    line: `✓ ATS score: ${score.before_score} → ${score.after_score} (+${score.after_score - score.before_score}). Keyword coverage: required ${score.keyword_coverage.required}, preferred ${score.keyword_coverage.preferred}.`,
  };
  if (coverLetter) {
    yield {
      type: 'pass-complete',
      pass: 4,
      line: `✓ Cover letter drafted — ${coverLetter.paragraphs.length} paragraphs, voice-matched.`,
    };
  }

  yield {
    type: 'system',
    line: `Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`,
  };

  yield { type: 'result', id: rewriteId };

  return {
    id: rewriteId,
    jdAnalysis,
    cvAnalysis,
    rewrite,
    score,
    coverLetter,     // undefined when includeCoverLetter was false
    createdAt: startedAt,
    jdSource: input.jdSource,
    cvSource: input.cvSource,
  };
}
