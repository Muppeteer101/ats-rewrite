import { NextRequest, NextResponse } from 'next/server';
import { parsePdf } from '@/lib/parsers/pdf';
import { parseDocx } from '@/lib/parsers/docx';
import { parseUrl } from '@/lib/parsers/url';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Three input modes, dispatched by Content-Type:
 *   - application/json with { url } → scrape via Readability
 *   - application/json with { text } → use as-is
 *   - multipart/form-data with `file` → extract via PDF/DOCX parser
 */
export async function POST(req: NextRequest): Promise<Response> {
  const ct = req.headers.get('content-type') ?? '';

  if (ct.includes('application/json')) {
    const body = (await req.json()) as { text?: string; url?: string };

    if (body.url) {
      try {
        const text = await parseUrl(body.url.trim());
        return NextResponse.json({ text, kind: 'url', charCount: text.length, source: body.url.trim() });
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 422 });
      }
    }

    const text = (body.text ?? '').trim();
    if (text.length < 30) {
      return NextResponse.json({ error: 'JD text looks too short — paste the full posting.' }, { status: 400 });
    }
    return NextResponse.json({ text, kind: 'text', charCount: text.length });
  }

  // File-upload path
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10MB).' }, { status: 413 });
  }

  const name = (file.name ?? '').toLowerCase();
  const arr = new Uint8Array(await file.arrayBuffer());

  try {
    let text = '';
    let kind: 'pdf' | 'docx' = 'pdf';
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      text = await parsePdf(arr);
      kind = 'pdf';
    } else if (
      name.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      text = await parseDocx(Buffer.from(arr));
      kind = 'docx';
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload a PDF or DOCX, paste the text, or share a URL.' },
        { status: 415 },
      );
    }

    if (text.length < 30) {
      return NextResponse.json(
        { error: "Couldn't extract enough text. Paste the JD text instead." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text, kind, charCount: text.length });
  } catch (e) {
    return NextResponse.json({ error: `Parse failed: ${(e as Error).message}` }, { status: 500 });
  }
}
