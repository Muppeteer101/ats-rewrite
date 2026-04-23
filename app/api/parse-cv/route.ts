import { NextRequest, NextResponse } from 'next/server';
import { parsePdf } from '@/lib/parsers/pdf';
import { parseDocx } from '@/lib/parsers/docx';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024; // 10MB — way more than any real CV

/**
 * Accepts a multipart/form-data upload with a single `file` field.
 * Returns `{ text, kind, charCount }`.
 *
 * For paste-text input, the front-end calls this same route with
 * `Content-Type: application/json` and `{ text: '...' }`.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const ct = req.headers.get('content-type') ?? '';

  // Paste-text path
  if (ct.includes('application/json')) {
    const body = (await req.json()) as { text?: string };
    const text = (body.text ?? '').trim();
    if (text.length < 50) {
      return NextResponse.json({ error: 'Resume text looks too short — paste the full content.' }, { status: 400 });
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
        { error: 'Unsupported file type. Upload a PDF or DOCX, or paste the text directly.' },
        { status: 415 },
      );
    }

    if (text.length < 50) {
      return NextResponse.json(
        { error: "Couldn't extract enough text from that file. Try a different format or paste the content." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text, kind, charCount: text.length });
  } catch (e) {
    return NextResponse.json(
      { error: `Parse failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
