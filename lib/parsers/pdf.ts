import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Extract plain text from a PDF buffer. unpdf is a maintained, no-native-deps
 * pdf.js wrapper that runs in serverless / edge environments without native bindings.
 *
 * Returned text is best-effort — we collapse runs of whitespace but otherwise
 * keep paragraph breaks intact so the downstream LLM can still infer
 * sectioning (Education / Experience / Skills etc.).
 */
export async function parsePdf(buf: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join('\n\n') : text;
  return normalize(merged);
}

function normalize(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
