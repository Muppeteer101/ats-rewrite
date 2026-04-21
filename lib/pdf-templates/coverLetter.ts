import { newDoc, toBase64, drawWrapped, A4 } from './shared';
import type { EngineResult } from '@/src/engine/schemas';

/**
 * Cover letter PDF — single template, plain Helvetica, business letter format.
 * Sender block top-right, recipient line, greeting, paragraphs, sign-off, name.
 * Same ATS-safe principles as the CV: single column, no tables/images.
 */
export function renderCoverLetter(result: EngineResult): string {
  const doc = newDoc();
  const cl = result.coverLetter;
  const c = result.rewrite.contact;

  const left = 22;
  const right = 22;
  const top = 22;
  const bottom = 22;
  const usable = A4.w - left - right;
  let y = top;

  // Sender block — name + contact at top-left, plain.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(c.name || cl.signature, left, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const contactBits = [c.email, c.phone, c.location].filter(Boolean) as string[];
  if (contactBits.length > 0) {
    doc.text(contactBits.join('  ·  '), left, y);
    y += 5;
  }
  if (c.links && c.links.length > 0) {
    doc.text(c.links.join('  ·  '), left, y);
    y += 5;
  }

  y += 6;

  // Date
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(today, left, y);
  y += 10;

  // Greeting
  doc.setFontSize(11);
  doc.text(cl.greeting, left, y);
  y += 8;

  // Paragraphs
  doc.setFontSize(11);
  for (const p of cl.paragraphs) {
    y = drawWrapped({
      doc,
      text: p,
      x: left,
      y,
      width: usable,
      topMargin: top,
      bottomMargin: bottom,
      lineHeight: 5.4,
    });
    y += 4;
  }

  y += 4;

  // Sign-off
  doc.text(cl.signoff, left, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text(cl.signature, left, y);

  return toBase64(doc);
}
