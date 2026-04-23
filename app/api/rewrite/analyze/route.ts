import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { runInitialAnalysis, type AnalysisSnapshot, type EngineInput } from '@/src/engine';
import type { NarrationEvent } from '@/src/engine/schemas';
import { redis, k } from '@/lib/redis';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/rewrite/analyze — Stage 1: FREE initial appraisal.
 *
 * Body: { cvText, jdText, cvSource, jdSource }
 * Response: SSE stream of NarrationEvent; terminates with { type: 'result', id }.
 *
 * Persists an AnalysisSnapshot under k.analysis(id) (24h TTL). The user is
 * NOT charged a credit at this stage — this is deliberately free to give them
 * a real number before the paywall.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const body = (await req.json()) as {
    draftId?: string;
    cvText?: string;
    jdText?: string;
    cvSource?: EngineInput['cvSource'];
    jdSource?: EngineInput['jdSource'];
  };
  if (!body.cvText || !body.jdText) {
    return new Response('Missing cvText or jdText', { status: 400 });
  }

  const input: EngineInput = {
    cvText: body.cvText,
    jdText: body.jdText,
    cvSource: body.cvSource ?? { kind: 'text' },
    jdSource: body.jdSource ?? { kind: 'text' },
  };
  // Use the client-provided draftId as the snapshot key so the URL, the
  // sessionStorage payload, and Redis all agree on one ID per flow.
  const analysisId = body.draftId?.match(/^[a-z0-9_-]{6,64}$/i) ? body.draftId : generateId();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: NarrationEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

      try {
        const gen = runInitialAnalysis(input, analysisId);
        let snapshot: AnalysisSnapshot | undefined;
        while (true) {
          const next = await gen.next();
          if (next.done) {
            snapshot = next.value;
            break;
          }
          send(next.value);
        }
        if (!snapshot) throw new Error('Analysis did not return a snapshot.');

        // Snapshot must hold the user binding so rescore/finalize can
        // enforce ownership.
        await redis.set(
          k.analysis(analysisId),
          { ...snapshot, userId },
          { ex: 24 * 60 * 60 },
        );

        controller.close();
      } catch (e) {
        send({ type: 'error', message: (e as Error).message ?? 'Analysis failed' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  });
}

function generateId(): string {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
