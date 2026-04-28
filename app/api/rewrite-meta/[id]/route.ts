import { NextRequest, NextResponse } from 'next/server';
import { redis, k } from '@/lib/redis';
import type { EngineResult } from '@/src/engine/schemas';

export const runtime = 'nodejs';

/**
 * GET /api/rewrite-meta/[id]?full=1
 *
 * Returns metadata about a completed rewrite.
 *
 * Lean (default) — what the result page header needs to render the top banner:
 *   { jobTitle, matchScore, atsPercentage, atsRating, verdict }
 *
 * Full (?full=1) — everything the result view needs for all seven blocks:
 *   the job/CV analyses, role-match, recruiter verdict, rewrite, cover letter,
 *   changes made, and ATS confidence.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const result = await redis.get<EngineResult>(k.rewrite(id));
  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const header = {
    jobTitle: result.jobAnalysis.roleTitle,
    matchScore: result.roleMatch.overallScore,
    atsPercentage: result.atsConfidence.percentage,
    atsRating: result.atsConfidence.rating,
    verdict: result.recruiterVerdict.decision,
  };

  const url = new URL(req.url);
  const full = url.searchParams.get('full') === '1';

  if (full) {
    return NextResponse.json({
      ...header,
      jobAnalysis: result.jobAnalysis,
      cvAnalysis: result.cvAnalysis,
      roleMatch: result.roleMatch,
      recruiterVerdict: result.recruiterVerdict,
      rewrite: result.rewrite,
      coverLetter: result.coverLetter,
      changesMade: result.changesMade,
      atsConfidence: result.atsConfidence,
    });
  }

  return NextResponse.json(header);
}
