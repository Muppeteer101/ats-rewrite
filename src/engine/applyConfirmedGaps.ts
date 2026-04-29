import type { CVAnalysis, JobAnalysis } from './schemas';

/**
 * Fold confirmed-gap experience into the structured CV analysis so Pass 3
 * and Pass 4 see the requirement as evidenced — not just as an instruction
 * to "treat as present". The LLM rubric reads structured fields; if we
 * leave the structure unchanged, scores barely move.
 *
 * For each confirmed gap we:
 *   1. find the closest matching JD skill (must-have or nice-to-have) and
 *      add it to cv.strengths.hardSkills if absent;
 *   2. append a one-line confirmation to candidateOverview.careerTrajectory
 *      so the prompt sees the experience referenced in prose;
 *   3. drop any cv.weaknesses.thinOrAbsentAreas / careerGaps line that
 *      substring-overlaps the resolved gap, so Pass 3 doesn't double-count
 *      it as both confirmed AND a documented weakness.
 */
export function applyConfirmedGapsToCv(
  cv: CVAnalysis,
  gaps: string[],
  job: JobAnalysis,
): CVAnalysis {
  if (gaps.length === 0) return cv;

  const next: CVAnalysis = JSON.parse(JSON.stringify(cv));
  const jdSkills = collectJdSkills(job);

  const confirmationLines: string[] = [];
  for (const gap of gaps) {
    const matched = matchJdSkill(gap, jdSkills);
    if (matched && !containsCi(next.strengths.hardSkills, matched)) {
      next.strengths.hardSkills.push(matched);
    }
    confirmationLines.push(
      `Candidate has confirmed: ${stripQuestion(gap)}${matched ? ` (${matched})` : ''}.`,
    );
    next.weaknesses.thinOrAbsentAreas = next.weaknesses.thinOrAbsentAreas.filter(
      (w) => !overlap(w, gap, matched),
    );
    next.weaknesses.missingQualifications = next.weaknesses.missingQualifications.filter(
      (w) => !overlap(w, gap, matched),
    );
  }

  const trail = confirmationLines.join(' ');
  next.candidateOverview.careerTrajectory =
    next.candidateOverview.careerTrajectory.trim().replace(/\.?$/, '.') + ' ' + trail;

  return next;
}

function collectJdSkills(job: JobAnalysis): string[] {
  return [
    ...job.mustHaves.hardSkills,
    ...job.mustHaves.qualifications,
    ...job.mustHaves.nonNegotiables,
    ...job.niceToHaves.skills,
    ...job.niceToHaves.qualifications,
    ...job.niceToHaves.additionalExperience,
    ...job.languageAndTone.keyPhrases,
    ...job.languageAndTone.jargon,
  ].filter(Boolean);
}

/** Best-effort substring + token-overlap match. Returns the JD skill verbatim
 *  so the rewrite later uses the JD's exact phrasing. */
function matchJdSkill(gap: string, jdSkills: string[]): string | null {
  const gapLower = gap.toLowerCase();
  const gapTokens = tokenise(gapLower);
  let best: { skill: string; score: number } | null = null;
  for (const skill of jdSkills) {
    const sLower = skill.toLowerCase();
    if (gapLower.includes(sLower) && sLower.length >= 3) {
      const score = sLower.length + 100;
      if (!best || score > best.score) best = { skill, score };
      continue;
    }
    const sTokens = tokenise(sLower);
    if (sTokens.length === 0) continue;
    const shared = sTokens.filter((t) => gapTokens.includes(t)).length;
    if (shared >= 2 || (shared >= 1 && sTokens.length === 1 && sTokens[0].length >= 5)) {
      const score = shared * 10 + sLower.length / 100;
      if (!best || score > best.score) best = { skill, score };
    }
  }
  return best?.skill ?? null;
}

const STOPWORDS = new Set([
  'do','you','have','has','can','evidence','any','the','a','an','of','in','on','at','for',
  'with','to','and','or','your','my','i','we','they','this','that','these','those',
  'experience','skills','knowledge','role','able','use','using','work','worked','working',
  'background','some','demonstrable','proven','strong','solid','direct','recent','prior',
]);

function tokenise(s: string): string[] {
  return s
    .replace(/[^a-z0-9+#./ -]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function containsCi(arr: string[], v: string): boolean {
  const vl = v.toLowerCase();
  return arr.some((x) => x.toLowerCase() === vl);
}

function stripQuestion(s: string): string {
  return s.replace(/\?+\s*$/, '').trim();
}

function overlap(weakness: string, gap: string, matched: string | null): boolean {
  const w = weakness.toLowerCase();
  if (matched && w.includes(matched.toLowerCase())) return true;
  const gapTokens = tokenise(gap.toLowerCase());
  if (gapTokens.length === 0) return false;
  const wTokens = tokenise(w);
  const shared = gapTokens.filter((t) => wTokens.includes(t)).length;
  return shared >= 2;
}
