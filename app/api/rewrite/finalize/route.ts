import { NextRequest } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { runFinalize, type AnalysisSnapshot } from '@/src/engine';
import type { EngineResult, NarrationEvent } from '@/src/engine/schemas';
import type { CreditState } from '@/lib/credits';
import { redis, k } from '@/lib/redis';
import { consumeCredit, recordRewrite } from '@/lib/credits';
import { sendRewriteReadyEmail } from '@/lib/email';
import { renderTemplate } from '@/lib/pdf-templates';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/rewrite/finalize — Stage 3: PAID rewrite + cover letter.
 *
 * Body: { analysisId, template?, sendEmail? }
 *
 * Charges one credit (lifetime-free → monthly-free → paid). If out of
 * credits returns 402. Streams SSE narration for passes 5 + 6. Persists the
 * final EngineResult under k.rewrite(rewriteId) and records it for the
 * dashboard. Sends the "rewrite ready" email with PDF attached.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const body = (await req.json()) as {
    analysisId?: string;
    template?: 'ats-clean' | 'professional' | 'modern';
    sendEmail?: boolean;
  };
  if (!body.analysisId) return new Response('Missing analysisId', { status: 400 });

  const stored = await redis.get<AnalysisSnapshot & { userId?: string }>(k.analysis(body.analysisId));
  if (!stored) return new Response('Analysis not found or expired', { status: 404 });
  if (stored.userId && stored.userId !== userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const template = body.template ?? 'ats-clean';
  const sendEmail = body.sendEmail !== false;

  // Charge a credit BEFORE the rewrite — the expensive LLM calls are here.
  const source = await consumeCredit(userId);
  if (!source) {
    return new Response(JSON.stringify({ error: 'out_of_credits' }), {
      status: 402,
      headers: { 'content-type': 'application/json' },
    });
  }

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
        await recordRewrite(userId, {
          id: rewriteId,
          jobTitle: result.jobAnalysis.roleTitle,
          date: result.createdAt,
          scoreBefore: result.roleMatch.overallScore,
          scoreAfter: result.atsConfidence.percentage,
          pdfTemplate: template,
        });

        // Free the analysis snapshot — it's been consumed.
        await redis.del(k.analysis(body.analysisId!));

        if (sendEmail) {
          try {
            const user = await currentUser();
            const email = user?.primaryEmailAddress?.emailAddress;
            if (email) {
              const pdfBase64 = renderTemplate(template, result);
              await redis.set(k.pdfCache(rewriteId, template), pdfBase64, { ex: 60 * 24 * 60 * 60 });

              let shareCode: string | undefined;
              try {
                const { stripe } = await import('@/lib/stripe');
                const promoCode = await stripe.promotionCodes.create({
                  promotion: { coupon: 'JO4UR95g', type: 'coupon' },
                  max_redemptions: 10,
                  metadata: { ownerEmail: email, site: 'TOOLYKIT' },
                });
                shareCode = promoCode.code;
                await redis.set(`share:owner:${promoCode.code}`, email, { ex: 60 * 60 * 24 * 365 });
              } catch (e) {
                console.error('share code generation failed', e);
              }

              const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
              const customerName =
                [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined;
              await sendRewriteReadyEmail({
                to: email,
                customerName,
                jobTitle: result.jobAnalysis.roleTitle,
                scoreBefore: result.roleMatch.overallScore,
                scoreAfter: result.atsConfidence.percentage,
                rewriteUrl: `${baseUrl}/rewrite/${rewriteId}`,
                pdfBase64,
                shareCode,
                sessionId: rewriteId,
              });
              send({ type: 'system', line: `✉ Sent to ${email} with the PDF attached.` });
            }
          } catch (e) {
            send({ type: 'warn', line: `⚠ Email skipped (${(e as Error).message}). PDF is on the result page.` });
          }
        }

        controller.close();
      } catch (e) {
        // Refund the credit on engine failure.
        try {
          const state = await redis.get<CreditState>(k.user(userId));
          if (state) {
            if (source === 'paid') {
              await redis.set(k.user(userId), {
                ...state,
                paidCredits: (state.paidCredits ?? 0) + 1,
                updatedAt: Date.now(),
              });
            } else if (source === 'monthly-free') {
              await redis.set(k.user(userId), {
                ...state,
                monthlyFreeUsed: false,
                updatedAt: Date.now(),
              });
            }
          }
        } catch {
          /* refund failure non-fatal */
        }

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
