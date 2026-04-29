import { callJson, MODELS } from '../llm';
import { PROMPT_3_MATCH } from '../prompts';
import {
  roleMatchSchema,
  type RoleMatch,
  type JobAnalysis,
  type CVAnalysis,
  type CVRoleEntry,
} from '../schemas';

/** "Today's date: 24 April 2026." — prefix for every user message so the LLM
 *  resolves "Present" against now, not the CV's authoring date. */
function todayLine(): string {
  const d = new Date();
  const month = d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `Today's date: ${d.getUTCDate()} ${month} ${d.getUTCFullYear()}. When a role end date is "Present" / "Current", treat it as today's date.`;
}

/** Pass 3 — Role Match Score. Haiku @ temp 0 (rubric-driven, cheap).
 *
 * Confirmed-gap evidence (from rescore) is folded into `cvAnalysis.confirmedAdditionalEvidence`
 * by the caller, not passed separately — the rubric scores against augmented
 * evidence using the same prompt. */
export async function runRoleMatch(opts: {
  jobAnalysis: JobAnalysis;
  cvAnalysis: CVAnalysis;
}): Promise<RoleMatch> {
  const user = [
    todayLine(),
    '',
    'JOB ANALYSIS:',
    JSON.stringify(opts.jobAnalysis, null, 2),
    '',
    'CV ANALYSIS:',
    JSON.stringify(opts.cvAnalysis, null, 2),
  ].join('\n');

  const result = await callJson({
    model: MODELS.haiku,
    system: PROMPT_3_MATCH,
    user,
    schema: roleMatchSchema,
    temperature: 0,
    maxTokens: 3500,
  });

  return {
    ...result,
    gaps: filterFalseDateRangeGaps(result.gaps, opts.cvAnalysis.roles),
  };
}

/* ────────────────────── Date-range gap validator ──────────────────────
 *
 * Even with the prompt instructions, an LLM can still emit a label like
 * "Unexplained 26-month career gap (Nov 2021–Jan 2024)" while the CV's roles
 * array clearly shows continuous employment across that period. Two-tier
 * safety net:
 *
 *   a) If the CV analysis yielded a populated roles[], strip any gap label
 *      whose parsed date range overlaps any listed role.
 *
 *   b) If roles[] is empty or missing (Pass 2 failed to enumerate), strip
 *      ANY gap label containing a month-year date range — we can't verify
 *      the claim, and hallucinated date-range gaps damage the candidate
 *      more than the rare case of a genuinely employment-less CV losing
 *      one legitimate-but-unverifiable label.
 */

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function parseMonthYear(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s === 'present' || s === 'current' || s === 'now' || s === 'today') {
    return Date.now();
  }
  const named = s.match(/^([a-z]+)\.?\s+(\d{4})$/);
  if (named) {
    const m = MONTHS[named[1]];
    const y = Number(named[2]);
    if (m === undefined || !Number.isFinite(y)) return null;
    return Date.UTC(y, m, 1);
  }
  const numeric = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (numeric) {
    const m = Number(numeric[1]) - 1;
    const y = Number(numeric[2]);
    if (m < 0 || m > 11) return null;
    return Date.UTC(y, m, 1);
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]) - 1;
    if (m < 0 || m > 11) return null;
    return Date.UTC(y, m, 1);
  }
  const year = s.match(/^(\d{4})$/);
  if (year) return Date.UTC(Number(year[1]), 0, 1);
  return null;
}

function extractRangeFromLabel(label: string): { start: number; end: number } | null {
  const re = /([A-Za-z]+\.?\s+\d{4}|\d{1,2}[\/\-]\d{4}|\d{4}-\d{1,2})\s*(?:[–\-—]|to)\s*([A-Za-z]+\.?\s+\d{4}|\d{1,2}[\/\-]\d{4}|\d{4}-\d{1,2}|present|current)/i;
  const m = label.match(re);
  if (!m) return null;
  const start = parseMonthYear(m[1]);
  const end = parseMonthYear(m[2]);
  if (start === null || end === null || end < start) return null;
  return { start, end };
}

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start <= b.end && b.start <= a.end;
}

function gapOverlapsAnyRole(
  gap: { start: number; end: number },
  roles: CVRoleEntry[],
): boolean {
  for (const role of roles) {
    const start = parseMonthYear(role.startDate);
    const end = parseMonthYear(role.endDate);
    if (start === null || end === null) continue;
    if (rangesOverlap(gap, { start, end })) return true;
  }
  return false;
}

export function filterFalseDateRangeGaps(
  gaps: string[],
  roles: CVRoleEntry[] | undefined,
): string[] {
  const hasRoles = Array.isArray(roles) && roles.length > 0;
  return gaps.filter((label) => {
    const range = extractRangeFromLabel(label);
    if (!range) return true;
    // Date-range label present. If we have ground truth, check overlap.
    if (hasRoles) return !gapOverlapsAnyRole(range, roles as CVRoleEntry[]);
    // No ground truth — strip the label rather than risk a hallucinated
    // chronology claim reaching the user.
    return false;
  });
}
