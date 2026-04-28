import { NextRequest } from 'next/server';
import { runRescore, type AnalysisSnapshot } from '@/src/engine';
import type { NarrationEvent } from '@/src/engine/schemas';
import { redis, k } from '@/lib/redis';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/rewrite/rescore — Stage 2: FREE rescore after gap confirmation.
 *
 * Body: { analysisId, confirmedGaps: string[] }
 * Response: SSE stream; terminates with { type: 'result', id }.
 *
 * No auth — this stage is free. Ownership is implicit: analysisIds are
 * crypto-random 24-byte hex (k.analysis), not enumerable.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as {
    analysisId?: string;
    confirmedGaps?: string[];
  };
  if (!body.analysisId || !Array.isArray(body.confirmedGaps)) {
    return new Response('Missing analysisId or confirmedGaps', { status: 400 });
  }

  const stored = await redis.get<AnalysisSnapshot>(k.analysis(body.analysisId));
  if (!stored) return new Response('Analysis not found or expired', { status: 404 });

  // Restrict the confirmedGaps to those that were actually in the gap list —
  // prevent arbitrary strings from being injected.
  const validGaps = new Set(stored.gaps);
  const confirmedGaps = body.confirmedGaps.filter((g) => validGaps.has(g));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: NarrationEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

      try {
        const gen = runRescore(stored, confirmedGaps);
        let updated: AnalysisSnapshot | undefined;
        while (true) {
          const next = await gen.next();
          if (next.done) {
            updated = next.value;
            break;
          }
          send(next.value);
        }
        if (!updated) throw new Error('Rescore did not return an updated snapshot.');

        await redis.set(
          k.analysis(body.analysisId!),
          updated,
          { ex: 24 * 60 * 60 },
        );

        controller.close();
      } catch (e) {
        send({ type: 'error', message: (e as Error).message ?? 'Rescore failed' });
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
