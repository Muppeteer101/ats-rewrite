import { analyzeJD } from './passes/analyzeJD';
import { analyzeCV } from './passes/analyzeCV';
import { rewriteCV } from './passes/rewriteCV';
import { scoreATS } from './passes/scoreATS';
import { generateCoverLetter } from './passes/coverLetter';
import type { EngineResult, NarrationEvent } from './schemas';

export type EngineInput = {
  cvText: string;
  jdText: string;
  cvSource: { kind: 'text' | 'pdf' | 'docx' };
  jdSource: { kind: 'text' | 'pdf' | 'docx' | 'url'; url?: string };
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

  yield { type: 'system', line: '› Engine starting — running 4 passes…' };

  // Pass 1 + Pass 2 in parallel — they're independent.
  yield { type: 'pass', pass: 1, line: '[Pass 1] Reading the job description…' };
  yield { type: 'pass', pass: 2, line: '[Pass 2] Analysing your CV…' };

  const [jdAnalysis, cvAnalysis] = await Promise.all([
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

  // Quick gap pre-flight to give the user an honest signal before Pass 3 starts.
  const cvLower = (input.cvText.toLowerCase() + ' ' + cvAnalysis.stated_skills.join(' ').toLowerCase());
  const gaps = jdAnalysis.required_skills.filter(
    (s) => !cvLower.includes(s.toLowerCase()),
  );
  if (gaps.length > 0) {
    yield {
      type: 'warn',
      line: `⚠ Heads-up: ${gaps.length} JD-required skill${gaps.length > 1 ? 's' : ''} not in your CV (${gaps.slice(0, 4).join(', ')}${gaps.length > 4 ? '…' : ''}). The rewrite will flag these honestly — not invent them.`,
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

  // Passes 4 + 5 in parallel — scoring and cover letter are both fed by the rewrite.
  yield { type: 'pass', pass: 4, line: '[Pass 4] Scoring against the JD…' };
  yield { type: 'pass', pass: 4, line: '[Pass 5] Drafting your cover letter…' };

  const [score, coverLetter] = await Promise.all([
    scoreATS({ jdAnalysis, rewrite }),
    generateCoverLetter({ jdText: input.jdText, jdAnalysis, cvAnalysis, rewrite }),
  ]);

  yield {
    type: 'pass-complete',
    pass: 4,
    line: `✓ ATS score: ${score.before_score} → ${score.after_score} (+${score.after_score - score.before_score}). Keyword coverage: required ${score.keyword_coverage.required}, preferred ${score.keyword_coverage.preferred}.`,
  };
  yield {
    type: 'pass-complete',
    pass: 4,
    line: `✓ Cover letter drafted — ${coverLetter.paragraphs.length} paragraphs, voice-matched.`,
  };

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
    coverLetter,
    createdAt: startedAt,
    jdSource: input.jdSource,
    cvSource: input.cvSource,
  };
}
