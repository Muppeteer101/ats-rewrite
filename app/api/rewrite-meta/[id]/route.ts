import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { redis, k } from '@/lib/redis';
import type { EngineResult } from '@/src/engine/schemas';

export const runtime = 'nodejs';

/**
 * GET /api/rewrite-meta/[id]?full=1
 *
 * Returns metadata about a rewrite. By default returns the lean fields the
 * result page header needs (jobTitle, scoreBefore, scoreAfter). Pass `full=1`
 * to also include the full rewrite + score JSON for the change-rationale +
 * gap-report views.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const result = await redis.get<EngineResult>(k.rewrite(id));
  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const full = url.searchParams.get('full') === '1';

  if (full) {
    return NextResponse.json({
      jobTitle: result.jdAnalysis.role_title,
      scoreBefore: result.score.before_score,
      scoreAfter: result.score.after_score,
      rewrite: result.rewrite,
      score: result.score,
      jdAnalysis: result.jdAnalysis,
      cvAnalysis: result.cvAnalysis,
    });
  }

  return NextResponse.json({
    jobTitle: result.jdAnalysis.role_title,
    scoreBefore: result.score.before_score,
    scoreAfter: result.score.after_score,
  });
}
