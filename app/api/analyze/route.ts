import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { analyzeJD } from '@/src/engine/passes/analyzeJD';
import { analyzeCV } from '@/src/engine/passes/analyzeCV';
import { detectGaps } from '@/src/engine/gap-detect';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/analyze
 *
 * Body: { cvText, jdText }
 *
 * Runs Pass 1 (JD analysis) + Pass 2 (CV analysis) in parallel and returns:
 *   - gaps: JD required skills not evidenced in the CV (word-level match)
 *   - preAnalysis: { jdAnalysis, cvAnalysis } — cached for the rewrite step
 *
 * Used by RewriteForm for the gap-confirm step. Passing preAnalysis back to
 * /api/rewrite skips re-running Pass 1+2 in the engine.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { cvText?: string; jdText?: string };
  if (!body.cvText || !body.jdText) {
    return NextResponse.json({ error: 'Missing cvText or jdText' }, { status: 400 });
  }

  const [jdAnalysis, cvAnalysis] = await Promise.all([
    analyzeJD(body.jdText),
    analyzeCV(body.cvText),
  ]);

  const gaps = detectGaps(jdAnalysis.required_skills, body.cvText, cvAnalysis);

  return NextResponse.json({ gaps, preAnalysis: { jdAnalysis, cvAnalysis } });
}
