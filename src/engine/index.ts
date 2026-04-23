import { runJobAnalysis } from './passes/pass1JobAnalysis';
import { runCvAnalysis } from './passes/pass2CvAnalysis';
import { runRoleMatch } from './passes/pass3RoleMatch';
import { runRecruiterVerdict } from './passes/pass4Verdict';
import { runRewrite } from './passes/pass5Rewrite';
import { runAtsConfidence } from './passes/pass6Ats';
import type {
  ATSConfidence,
  CVAnalysis,
  CoverLetter,
  EngineResult,
  JobAnalysis,
  NarrationEvent,
  NarrationTone,
  RecruiterVerdict,
  RewriteOutput,
  RoleMatch,
} from './schemas';

const scoreTone = (n: number): NarrationTone =>
  n >= 70 ? 'good' : n >= 40 ? 'amber' : 'bad';
const verdictTone = (v: string): NarrationTone =>
  v === 'YES' ? 'good' : v === 'MAYBE' ? 'amber' : 'bad';
const atsTone = (r: string): NarrationTone =>
  r === 'HIGH' ? 'good' : r === 'MEDIUM' ? 'amber' : 'bad';

export type EngineInput = {
  cvText: string;
  jdText: string;
  cvSource: { kind: 'text' | 'pdf' | 'docx' };
  jdSource: { kind: 'text' | 'pdf' | 'docx' | 'url'; url?: string };
};

/**
 * Intermediate state persisted after the initial appraisal. Everything a
 * later stage (rescore / finalize) needs is captured here so the later
 * stages don't need to re-run the expensive analyses.
 */
export type AnalysisSnapshot = {
  id: string;
  createdAt: number;
  jobSource: EngineInput['jdSource'];
  cvSource: EngineInput['cvSource'];
  cvText: string;
  jobAnalysis: JobAnalysis;
  cvAnalysis: CVAnalysis;
  roleMatch: RoleMatch;
  recruiterVerdict: RecruiterVerdict;
  /** ATS confidence on the ORIGINAL CV — the pre-rewrite baseline. */
  atsOriginal: ATSConfidence;
  /** All gaps identified in pass 3, surfaced for user confirmation. */
  gaps: string[];
  /** Gaps the user confirmed they DO have — merged on rescore. */
  confirmedGaps: string[];
  /** Scores after rescore (if rescored). Empty until /rescore runs. */
  rescored?: {
    roleMatch: RoleMatch;
    recruiterVerdict: RecruiterVerdict;
    atsOriginal: ATSConfidence;
  };
};

export type FinalizeResult = {
  rewrite: RewriteOutput;
  coverLetter: CoverLetter;
  changesMade: string[];
  atsFinal: ATSConfidence;
};

/* ────────────────────── Stage 1 — Initial analysis ────────────────────── */

/**
 * Runs passes 1, 2, 3, 4, and 6-on-original. Yields narration events and
 * returns an AnalysisSnapshot the API route persists and returns to the UI.
 */
export async function* runInitialAnalysis(
  input: EngineInput,
  id: string,
): AsyncGenerator<NarrationEvent, AnalysisSnapshot, void> {
  yield { type: 'system', line: '› Engine starting — initial appraisal…' };

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
    tone: 'info',
    line: `✓ Job: "${jobAnalysis.roleTitle}" (${jobAnalysis.seniorityLevel}) — ${jobAnalysis.mustHaves.hardSkills.length} must-have, ${jobAnalysis.niceToHaves.skills.length} nice-to-have.`,
  };
  yield {
    type: 'pass-complete',
    pass: 2,
    tone: 'info',
    line: `✓ CV: ${cvAnalysis.candidateOverview.yearsOfExperience} experience (${cvAnalysis.candidateOverview.seniorityLevel}).`,
  };

  // ── Pass 3 ──────────────────────────────────────────────────────────
  yield { type: 'pass', pass: 3, line: '[Pass 3] Scoring role match…' };
  const roleMatch = await runRoleMatch({ jobAnalysis, cvAnalysis });
  yield {
    type: 'pass-complete',
    pass: 3,
    tone: scoreTone(roleMatch.overallScore),
    line: `✓ Match: ${roleMatch.overallScore}/100.`,
  };

  // ── Pass 4 ──────────────────────────────────────────────────────────
  yield { type: 'pass', pass: 4, line: '[Pass 4] Running the recruiter verdict…' };
  const recruiterVerdict = await runRecruiterVerdict({ jobAnalysis, cvAnalysis, roleMatch });
  yield {
    type: 'pass-complete',
    pass: 4,
    tone: verdictTone(recruiterVerdict.decision),
    line: `✓ Verdict: ${recruiterVerdict.decision}.`,
  };

  // ── Pass 6 on ORIGINAL ──────────────────────────────────────────────
  yield { type: 'pass', pass: 6, line: '[Pass 6] Running ATS confidence check…' };
  const atsOriginal = await runAtsConfidence({
    mode: 'original',
    originalCv: input.cvText,
    jobAnalysis,
  });
  yield {
    type: 'pass-complete',
    pass: 6,
    tone: atsTone(atsOriginal.rating),
    line: `✓ ATS: ${atsOriginal.rating} (${atsOriginal.percentage}%).`,
  };

  const gaps = (roleMatch.gaps ?? []).slice(0, 8);

  yield {
    type: 'teaser',
    data: {
      matchScore: roleMatch.overallScore,
      verdictDecision: recruiterVerdict.decision,
      atsRating: atsOriginal.rating,
      atsPercentage: atsOriginal.percentage,
      gaps,
      jobTitle: jobAnalysis.roleTitle,
    },
  };
  yield { type: 'result', id };

  const snapshot: AnalysisSnapshot = {
    id,
    createdAt: Date.now(),
    jobSource: input.jdSource,
    cvSource: input.cvSource,
    cvText: input.cvText,
    jobAnalysis,
    cvAnalysis,
    roleMatch,
    recruiterVerdict,
    atsOriginal,
    gaps,
    confirmedGaps: [],
  };
  return snapshot;
}

/* ────────────────────── Stage 2 — Rescore with confirmed gaps ────────────────────── */

export async function* runRescore(
  snapshot: AnalysisSnapshot,
  confirmedGaps: string[],
): AsyncGenerator<NarrationEvent, AnalysisSnapshot, void> {
  yield { type: 'system', line: '› Rescoring with your confirmed experience…' };

  yield { type: 'pass', pass: 3, line: '[Pass 3] Rescoring role match…' };
  const roleMatch = await runRoleMatch({
    jobAnalysis: snapshot.jobAnalysis,
    cvAnalysis: snapshot.cvAnalysis,
    confirmedGaps,
  });
  yield {
    type: 'pass-complete',
    pass: 3,
    tone: scoreTone(roleMatch.overallScore),
    line: `✓ New match: ${roleMatch.overallScore}/100.`,
  };

  yield { type: 'pass', pass: 4, line: '[Pass 4] Rerunning recruiter verdict…' };
  const recruiterVerdict = await runRecruiterVerdict({
    jobAnalysis: snapshot.jobAnalysis,
    cvAnalysis: snapshot.cvAnalysis,
    roleMatch,
    confirmedGaps,
  });
  yield {
    type: 'pass-complete',
    pass: 4,
    tone: verdictTone(recruiterVerdict.decision),
    line: `✓ New verdict: ${recruiterVerdict.decision}.`,
  };

  yield { type: 'pass', pass: 6, line: '[Pass 6] Rerunning ATS confidence…' };
  const atsOriginal = await runAtsConfidence({
    mode: 'original',
    originalCv: snapshot.cvText,
    jobAnalysis: snapshot.jobAnalysis,
    confirmedGaps,
  });
  yield {
    type: 'pass-complete',
    pass: 6,
    tone: atsTone(atsOriginal.rating),
    line: `✓ New ATS: ${atsOriginal.rating} (${atsOriginal.percentage}%).`,
  };

  yield {
    type: 'teaser',
    data: {
      matchScore: roleMatch.overallScore,
      verdictDecision: recruiterVerdict.decision,
      atsRating: atsOriginal.rating,
      atsPercentage: atsOriginal.percentage,
      gaps: snapshot.gaps,
      jobTitle: snapshot.jobAnalysis.roleTitle,
    },
  };
  yield { type: 'result', id: snapshot.id };

  return {
    ...snapshot,
    confirmedGaps,
    rescored: { roleMatch, recruiterVerdict, atsOriginal },
  };
}

/* ────────────────────── Stage 3 — Finalize (paid) ────────────────────── */

export async function* runFinalize(
  snapshot: AnalysisSnapshot,
): AsyncGenerator<NarrationEvent, EngineResult, void> {
  yield { type: 'system', line: '› Producing your rewritten CV + cover letter…' };

  // Use rescored match/verdict if available, else original — either way,
  // the rewrite sees the confirmed gaps and the latest scoring context.
  const roleMatch = snapshot.rescored?.roleMatch ?? snapshot.roleMatch;
  const recruiterVerdict = snapshot.rescored?.recruiterVerdict ?? snapshot.recruiterVerdict;

  yield { type: 'pass', pass: 5, line: '[Pass 5] Rewriting your CV and drafting the cover letter…' };
  const pass5 = await runRewrite({
    originalCv: snapshot.cvText,
    jobAnalysis: snapshot.jobAnalysis,
    roleMatch,
    recruiterVerdict,
    confirmedGaps: snapshot.confirmedGaps,
  });
  yield {
    type: 'pass-complete',
    pass: 5,
    tone: 'info',
    line: `✓ Rewrite: ${pass5.rewrittenCV.roles.length} roles, ${pass5.changesMade.length} changes.`,
  };

  yield { type: 'pass', pass: 6, line: '[Pass 6] Rerunning ATS on the rewrite…' };
  const atsFinal = await runAtsConfidence({
    mode: 'rewritten',
    rewrittenCV: pass5.rewrittenCV,
    jobAnalysis: snapshot.jobAnalysis,
    confirmedGaps: snapshot.confirmedGaps,
  });
  yield {
    type: 'pass-complete',
    pass: 6,
    tone: atsTone(atsFinal.rating),
    line: `✓ Final ATS: ${atsFinal.rating} (${atsFinal.percentage}%).`,
  };

  yield { type: 'result', id: snapshot.id };

  const result: EngineResult = {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    jobSource: snapshot.jobSource,
    cvSource: snapshot.cvSource,
    jobAnalysis: snapshot.jobAnalysis,
    cvAnalysis: snapshot.cvAnalysis,
    roleMatch,
    recruiterVerdict,
    rewrite: pass5.rewrittenCV,
    coverLetter: pass5.coverLetter,
    changesMade: pass5.changesMade,
    atsConfidence: atsFinal,
    confirmedGaps: snapshot.confirmedGaps,
    atsOriginal: snapshot.rescored?.atsOriginal ?? snapshot.atsOriginal,
  };
  return result;
}
