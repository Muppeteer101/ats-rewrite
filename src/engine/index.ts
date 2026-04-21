import { runJobAnalysis } from './passes/pass1JobAnalysis';
import { runCvAnalysis } from './passes/pass2CvAnalysis';
import { runRoleMatch } from './passes/pass3RoleMatch';
import { runRecruiterVerdict } from './passes/pass4Verdict';
import { runRewrite } from './passes/pass5Rewrite';
import { runAtsConfidence } from './passes/pass6Ats';
import type { EngineResult, NarrationEvent } from './schemas';

export type EngineInput = {
  cvText: string;
  jdText: string;
  cvSource: { kind: 'text' | 'pdf' | 'docx' };
  jdSource: { kind: 'text' | 'pdf' | 'docx' | 'url'; url?: string };
};

/**
 * Run all six passes, yielding NarrationEvents that the SSE route streams
 * to the user, and finishing with an EngineResult that the route persists
 * to Redis under `k.rewrite(id)`.
 *
 * Ordering:
 *   Pass 1 (Job Analysis) + Pass 2 (CV Analysis)   — parallel
 *   Pass 3 (Role Match Score)                      — needs 1 + 2
 *   Pass 4 (Recruiter Verdict)                     — needs 1 + 2 + 3
 *   Pass 5 (Rewrite + Cover + Changes)             — needs original + 1 + 3 + 4
 *   Pass 6 (ATS Confidence)                        — needs rewrite + 1
 *
 * Narration is emitted before each pass starts and after each pass completes,
 * so the user sees the engine thinking rather than a static spinner.
 */
export async function* runEngine(
  input: EngineInput,
  rewriteId: string,
): AsyncGenerator<NarrationEvent, EngineResult, void> {
  yield { type: 'system', line: '› Engine starting — six-pass analysis…' };

  // ── Passes 1 + 2 (parallel) ─────────────────────────────────────────
  yield { type: 'pass', pass: 1, line: '[Pass 1] Analysing the job description…' };
  yield { type: 'pass', pass: 2, line: '[Pass 2] Analysing your CV…' };

  const [jobAnalysis, cvAnalysis] = await Promise.all([
    runJobAnalysis(input.jdText),
    runCvAnalysis(input.cvText),
  ]);

  yield {
    type: 'pass-complete',
    pass: 1,
    line: `✓ Job: "${jobAnalysis.roleTitle}" (${jobAnalysis.seniorityLevel}) — ${jobAnalysis.mustHaves.hardSkills.length} must-have skills, ${jobAnalysis.niceToHaves.skills.length} nice-to-have.`,
  };
  yield {
    type: 'pass-complete',
    pass: 2,
    line: `✓ CV: ${cvAnalysis.candidateOverview.yearsOfExperience} experience (${cvAnalysis.candidateOverview.seniorityLevel}) — ${cvAnalysis.strengths.hardSkills.length} demonstrated skills, ${cvAnalysis.weaknesses.thinOrAbsentAreas.length} gap areas flagged.`,
  };

  // ── Pass 3 ──────────────────────────────────────────────────────────
  yield { type: 'pass', pass: 3, line: '[Pass 3] Scoring role match…' };
  const roleMatch = await runRoleMatch({ jobAnalysis, cvAnalysis });
  yield {
    type: 'pass-complete',
    pass: 3,
    line: `✓ Match: ${roleMatch.overallScore}/100 — ${roleMatch.pilePosition} pile.`,
  };

  // ── Pass 4 ──────────────────────────────────────────────────────────
  yield { type: 'pass', pass: 4, line: '[Pass 4] Running the recruiter verdict…' };
  const recruiterVerdict = await runRecruiterVerdict({ jobAnalysis, cvAnalysis, roleMatch });
  yield {
    type: 'pass-complete',
    pass: 4,
    line: `✓ Verdict: ${recruiterVerdict.decision} — ${recruiterVerdict.oneSentenceReason}`,
  };

  // ── Pass 5 ──────────────────────────────────────────────────────────
  yield { type: 'pass', pass: 5, line: '[Pass 5] Rewriting the CV and drafting the cover letter…' };
  const pass5 = await runRewrite({
    originalCv: input.cvText,
    jobAnalysis,
    roleMatch,
    recruiterVerdict,
  });
  yield {
    type: 'pass-complete',
    pass: 5,
    line: `✓ Rewrite: ${pass5.rewrittenCV.roles.length} roles restructured, ${pass5.rewrittenCV.skills.length} skills surfaced, ${pass5.changesMade.length} changes logged. Cover letter: ${pass5.coverLetter.paragraphs.length} paragraphs.`,
  };

  // ── Pass 6 ──────────────────────────────────────────────────────────
  yield { type: 'pass', pass: 6, line: '[Pass 6] Running ATS confidence check…' };
  const atsConfidence = await runAtsConfidence({
    rewrittenCV: pass5.rewrittenCV,
    jobAnalysis,
  });
  yield {
    type: 'pass-complete',
    pass: 6,
    line: `✓ ATS: ${atsConfidence.rating} confidence (${atsConfidence.percentage}% pass likelihood).`,
  };

  yield { type: 'result', id: rewriteId };

  const result: EngineResult = {
    id: rewriteId,
    createdAt: Date.now(),
    jobSource: input.jdSource,
    cvSource: input.cvSource,
    jobAnalysis,
    cvAnalysis,
    roleMatch,
    recruiterVerdict,
    rewrite: pass5.rewrittenCV,
    coverLetter: pass5.coverLetter,
    changesMade: pass5.changesMade,
    atsConfidence,
  };
  return result;
}
