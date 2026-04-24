import { callJson, MODELS } from '../llm';
import { PROMPT_3_MATCH } from '../prompts';
import {
  roleMatchSchema,
  type RoleMatch,
  type JobAnalysis,
  type CVAnalysis,
  type CVRoleEntry,
} from '../schemas';

/** Pass 3 — Role Match Score. Haiku @ temp 0 (rubric-driven, cheap). */
export async function runRoleMatch(opts: {
  jobAnalysis: JobAnalysis;
  cvAnalysis: CVAnalysis;
  /** Gaps the candidate confirmed they DO have, even though not on the CV. */
  confirmedGaps?: string[];
}): Promise<RoleMatch> {
  const parts = [
    'JOB ANALYSIS:',
    JSON.stringify(opts.jobAnalysis, null, 2),
    '',
    'CV ANALYSIS:',
    JSON.stringify(opts.cvAnalysis, null, 2),
  ];
  if (opts.confirmedGaps && opts.confirmedGaps.length > 0) {
    parts.push('', 'CONFIRMED-GAP EXPERIENCE (candidate has affirmed they have these, even though not on the CV — treat as EVIDENCED):');
    for (const g of opts.confirmedGaps) parts.push(`- ${g}`);
  }
  const user = parts.join('\n');

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
 * array clearly shows continuous employment across that period. This is the
 * deterministic safety net: if a gap label contains a date range that
 * overlaps any listed role, drop it.
 *
 * Conservative by design — we only strip gaps where:
 *   1. the label parses cleanly into two month-year endpoints, AND
 *   2. at least one role in the CV overlaps the parsed range.
 * Anything else is left for the LLM's judgement.
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

/** Returns a millis-since-epoch for the first day of the month, or null. */
function parseMonthYear(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s === 'present' || s === 'current' || s === 'now' || s === 'today') {
    return Date.now();
  }
  // "Feb 2022", "February 2022", "Feb. 2022", "02/2022", "2022-02"
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
  // Bare year — treat as January.
  const year = s.match(/^(\d{4})$/);
  if (year) return Date.UTC(Number(year[1]), 0, 1);
  return null;
}

/** Extracts the first (start, end) month-year pair from a free-text label. */
function extractRangeFromLabel(label: string): { start: number; end: number } | null {
  // Match "Nov 2021–Jan 2024", "November 2021 - January 2024", "11/2021 to 01/2024"
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

/** True if any listed role's date range overlaps the gap's date range. */
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
  if (!roles || roles.length === 0) return gaps;
  return gaps.filter((label) => {
    const range = extractRangeFromLabel(label);
    if (!range) return true;
    return !gapOverlapsAnyRole(range, roles);
  });
}
