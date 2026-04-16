import mammoth from 'mammoth';

/**
 * Extract plain text from a DOCX buffer. Mammoth handles Word's XML markup
 * and gives us a clean text dump suitable for sending to the engine.
 *
 * We use `extractRawText` over `convertToHtml` because the LLM passes don't
 * need formatting — they want clean paragraphs to reason about.
 */
export async function parseDocx(buf: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
