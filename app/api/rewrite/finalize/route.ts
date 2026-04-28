import { NextRequest } from 'next/server';
import { runFinalize, type AnalysisSnapshot } from '@/src/engine';
import type { EngineResult, NarrationEvent } from '@/src/engine/schemas';
import { redis, k } from '@/lib/redis';
import { sendRewriteReadyEmail } from '@/lib/email';
import { renderTemplate } from '@/lib/pdf-templates';
import { verifySpendToken } from '@/lib/al-spend';

export const runtime = 'nodejs';
export const maxDuration = 300;

const REPLAY_TTL_SECONDS = 10 * 60; // longer than the 5-min token TTL

/**
 * POST /api/rewrite/finalize — Stage 3: PAID rewrite + cover letter.
 *
 * Body: { analysisId, template?, sendEmail?, spendToken }
 *
 * The credit was already debited on almostlegal.ai/spend before the user
 * arrived back here. We just verify the JWT, run the work, and stream SSE.
 *
 * If the JWT is missing or invalid we return 401 — the client should
 * redirect the browser to /spend to acquire one.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as {
    analysisId?: string;
    template?: 'ats-clean' | 'professional' | 'modern';
    sendEmail?: boolean;
    spendToken?: string;
  };

  if (!body.spendToken) {
    return new Response('Missing spendToken', { status: 401 });
  }

  let token;
  try {
    token = await verifySpendToken(body.spendToken, 'improvemyresume');
  } catch {
    return new Response('Invalid or expired spendToken', { status: 401 });
  }

  // Replay protection — each jti can only be redeemed once. Token TTL is
  // 5 min on AL, we hold the redemption marker for 10 min so even a clock
  // skew can't get the same token spent twice.
  const replayKey = `imr:spend:redeemed:${token.jti}`;
  const claimed = await redis.set(replayKey, '1', { ex: REPLAY_TTL_SECONDS, nx: true });
  if (claimed !== 'OK') {
    return new Response('spendToken already redeemed', { status: 401 });
  }

  if (!body.analysisId) return new Response('Missing analysisId', { status: 400 });

  const stored = await redis.get<AnalysisSnapshot>(k.analysis(body.analysisId));
  if (!stored) return new Response('Analysis not found or expired', { status: 404 });

  const template = body.template ?? 'ats-clean';
  const sendEmail = body.sendEmail !== false;
  const userEmail = token.email;
  const source = token.source;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: NarrationEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

      try {
        send({ type: 'system', line: `› Charged 1 credit (${source}). Producing your rewrite…` });

        const gen = runFinalize(stored);
        let result: EngineResult | undefined;
        while (true) {
          const next = await gen.next();
          if (next.done) {
            result = next.value;
            break;
          }
          send(next.value);
        }
        if (!result) throw new Error('Finalize did not return a result.');

        const rewriteId = result.id;
        await redis.set(k.rewrite(rewriteId), result, { ex: 60 * 24 * 60 * 60 });
        await redis.del(k.analysis(body.analysisId!));

        if (sendEmail && userEmail) {
          try {
            const pdfBase64 = renderTemplate(template, result);
            await redis.set(k.pdfCache(rewriteId, template), pdfBase64, { ex: 60 * 24 * 60 * 60 });

            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
            await sendRewriteReadyEmail({
              to: userEmail,
              jobTitle: result.jobAnalysis.roleTitle,
              scoreBefore: result.roleMatch.overallScore,
              scoreAfter: result.atsConfidence.percentage,
              rewriteUrl: `${baseUrl}/rewrite/${rewriteId}`,
              pdfBase64,
              sessionId: rewriteId,
            });
            send({ type: 'system', line: `✉ Sent to ${userEmail} with the PDF attached.` });
          } catch (e) {
            send({ type: 'warn', line: `⚠ Email skipped (${(e as Error).message}). PDF is on the result page.` });
          }
        }

        controller.close();
      } catch (e) {
        // The credit was debited on AL before we got the token. We don't
        // automatically refund here — if engine failures become a problem,
        // add an `/api/spend/refund` callback to AL keyed off the jti.
        send({ type: 'error', message: (e as Error).message ?? 'Rewrite failed' });
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
