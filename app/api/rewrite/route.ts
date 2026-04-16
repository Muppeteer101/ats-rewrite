import { NextRequest } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { runEngine, type EngineInput } from '@/src/engine';
import type { EngineResult, NarrationEvent } from '@/src/engine/schemas';
import type { CreditState } from '@/lib/credits';
import { redis, k } from '@/lib/redis';
import { consumeCredit, recordRewrite } from '@/lib/credits';
import { sendRewriteReadyEmail } from '@/lib/email';
import { renderTemplate } from '@/lib/pdf-templates';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — engine targets <90s but give headroom

/**
 * POST /api/rewrite
 *
 * Body: { cvText, jdText, cvSource, jdSource, template?, sendEmail? }
 *
 * Response: text/event-stream of NarrationEvent objects, terminating with
 *   { type: 'result', id }
 * or
 *   { type: 'error', message }
 *
 * Side effects:
 *   - Consumes one credit (lifetime-free → monthly-free → paid).
 *   - Persists EngineResult under k.rewrite(id).
 *   - Indexes the rewrite under the user (k.rewrites(userId)).
 *   - If sendEmail (default true), renders the chosen template + sends Resend email with PDF.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = (await req.json()) as {
    cvText?: string;
    jdText?: string;
    cvSource?: EngineInput['cvSource'];
    jdSource?: EngineInput['jdSource'];
    template?: 'ats-clean' | 'professional' | 'modern';
    sendEmail?: boolean;
  };

  if (!body.cvText || !body.jdText) {
    return new Response('Missing cvText or jdText', { status: 400 });
  }

  // Charge a credit BEFORE running the engine (refunded on hard failure).
  const source = await consumeCredit(userId);
  if (!source) {
    // 402 Payment Required — front-end shows the upsell modal.
    return new Response(JSON.stringify({ error: 'out_of_credits' }), {
      status: 402,
      headers: { 'content-type': 'application/json' },
    });
  }

  const input: EngineInput = {
    cvText: body.cvText,
    jdText: body.jdText,
    cvSource: body.cvSource ?? { kind: 'text' },
    jdSource: body.jdSource ?? { kind: 'text' },
  };
  const rewriteId = generateId();
  const template = body.template ?? 'ats-clean';
  const sendEmail = body.sendEmail !== false;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: NarrationEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };

      try {
        send({ type: 'system', line: `› Charged 1 credit (${source}). Booting engine…` });

        const gen = runEngine(input, rewriteId);
        let result: EngineResult | undefined;
        while (true) {
          const next = await gen.next();
          if (next.done) {
            result = next.value;
            break;
          }
          send(next.value);
        }
        if (!result) throw new Error('Engine did not return a result.');

        // Persist — 60-day TTL is plenty (dashboard re-download window).
        await redis.set(k.rewrite(rewriteId), result, { ex: 60 * 24 * 60 * 60 });
        await recordRewrite(userId, {
          id: rewriteId,
          jobTitle: result.jdAnalysis.role_title,
          date: result.createdAt,
          scoreBefore: result.score.before_score,
          scoreAfter: result.score.after_score,
          pdfTemplate: template,
        });

        // Render the chosen template + (optionally) email it.
        if (sendEmail) {
          try {
            const user = await currentUser();
            const email = user?.primaryEmailAddress?.emailAddress;
            if (email) {
              const pdfBase64 = renderTemplate(template, result);
              await redis.set(k.pdfCache(rewriteId, template), pdfBase64, { ex: 60 * 24 * 60 * 60 });

              const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
              await sendRewriteReadyEmail({
                to: email,
                jobTitle: result.jdAnalysis.role_title,
                scoreBefore: result.score.before_score,
                scoreAfter: result.score.after_score,
                rewriteUrl: `${baseUrl}/rewrite/${rewriteId}`,
                pdfBase64,
              });
              send({ type: 'system', line: `✉ Sent to ${email} with the PDF attached.` });
            }
          } catch (e) {
            // Email failure is not fatal — the rewrite is still persisted.
            send({ type: 'warn', line: `⚠ Could not send email (${(e as Error).message}). PDF still available on the result page.` });
          }
        }

        controller.close();
      } catch (e) {
        // Refund the credit on engine failure — it's not the user's fault.
        try {
          // We deliberately don't refund the lifetime-free flag (it stays consumed)
          // because the user did get to see narration; instead we just bump paidCredits
          // by 1 if the source was 'paid', and bump monthly bucket back if monthly.
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
          /* refund failure is non-fatal */
        }

        send({ type: 'error', message: (e as Error).message ?? 'Engine failure' });
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
  // Compact, URL-safe, sortable-ish (timestamp prefix + 8 chars random).
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `r_${ts}_${rand}`;
}
