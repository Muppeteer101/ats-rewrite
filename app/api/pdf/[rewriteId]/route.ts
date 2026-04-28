import { NextRequest, NextResponse } from 'next/server';
import { redis, k } from '@/lib/redis';
import { renderTemplate, type TemplateId } from '@/lib/pdf-templates';
import type { EngineResult } from '@/src/engine/schemas';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Re-download a PDF for a previously-completed rewrite, in any of the
 * three templates. We cache the rendered base64 in Redis on first request
 * so subsequent template-switches or re-downloads are instant.
 *
 * Auth: the rewriteId is unguessable (timestamp + 8 random chars). The
 * page that consumes this endpoint is reached only after a successful
 * paid finalize, and the rewriteId is not exposed in any public listing.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ rewriteId: string }> },
): Promise<Response> {
  const { rewriteId } = await ctx.params;
  const url = new URL(req.url);
  const rawTemplate = (url.searchParams.get('template') ?? 'ats-clean') as TemplateId;
  const template: TemplateId =
    rawTemplate === 'ats-clean' ||
    rawTemplate === 'professional' ||
    rawTemplate === 'modern' ||
    rawTemplate === 'cover-letter'
      ? rawTemplate
      : 'ats-clean';

  // Fast path — cached base64 from a prior render.
  const cached = await redis.get<string>(k.pdfCache(rewriteId, template));
  let base64: string;
  if (cached) {
    base64 = cached;
  } else {
    const result = await redis.get<EngineResult>(k.rewrite(rewriteId));
    if (!result) {
      return new NextResponse('Rewrite not found or expired.', { status: 404 });
    }
    base64 = renderTemplate(template, result);
    await redis.set(k.pdfCache(rewriteId, template), base64, { ex: 60 * 24 * 60 * 60 });
  }

  const buf = Buffer.from(base64, 'base64');
  const result = await redis.get<EngineResult>(k.rewrite(rewriteId));
  const slug = (result?.jobAnalysis.roleTitle ?? 'cv')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  // `?download=1` forces a save-as download; otherwise the PDF is served
  // inline so it renders in <iframe>/<object> previews instead of triggering
  // a download prompt every time the user tabs between templates.
  const filename = `cv-${slug || 'rewrite'}-${template}.pdf`;
  const wantsDownload = url.searchParams.get('download') === '1';
  const disposition = wantsDownload
    ? `attachment; filename="${filename}"`
    : `inline; filename="${filename}"`;

  return new NextResponse(buf, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': disposition,
      'cache-control': 'private, max-age=300',
      // Some browsers treat X-Content-Type-Options: nosniff as a hint to
      // honour the Content-Type for inline rendering.
      'x-content-type-options': 'nosniff',
    },
  });
}
