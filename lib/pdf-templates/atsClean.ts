import { newDoc, toBase64, drawWrapped, flatten, A4 } from './shared';
import type { EngineResult } from '@/src/engine/schemas';

/**
 * ATS-clean template — the default and recommended choice.
 *
 * Design goals (in priority order):
 *   1. Maximum ATS parse rate — single column, no tables, no images, no
 *      sidebars, no text in shapes, no columns, no headers/footers with
 *      contact info (parsers miss these), Helvetica only.
 *   2. Plain section labels in ALL CAPS — what every ATS regex expects.
 *   3. Generous left margin and uniform line spacing — keeps OCR re-runs
 *      consistent if the file ever gets flattened back to image-PDF.
 *   4. No accent colours, no background fills — black text on white.
 */
export function renderAtsClean(result: EngineResult): string {
  const doc = newDoc();
  const data = flatten(result);

  const left = 18;
  const right = 18;
  const top = 18;
  const bottom = 18;
  const usableWidth = A4.w - left - right;

  let y = top;

  // Name — clear, large, no styling tricks.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(data.name || 'Candidate', left, y);
  y += 8;

  // Contact line — plain text, single line.
  if (data.contactLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(data.contactLine, left, y);
    y += 5;
  }
  if (data.links.length > 0) {
    doc.setFontSize(10);
    doc.text(data.links.join('  ·  '), left, y);
    y += 5;
  }
  y += 3;

  // Summary
  if (data.summary) {
    section(doc, 'PROFESSIONAL SUMMARY', left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    y = drawWrapped({
      doc,
      text: data.summary,
      x: left,
      y,
      width: usableWidth,
      topMargin: top,
      bottomMargin: bottom,
      lineHeight: 5,
    });
    y += 4;
  }

  // Experience
  section(doc, 'EXPERIENCE', left, y);
  y += 6;
  for (const role of data.roles) {
    if (y > A4.h - bottom - 20) {
      doc.addPage();
      y = top;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(role.title, left, y);
    if (role.dates) {
      const datesWidth = doc.getTextWidth(role.dates);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(role.dates, A4.w - right - datesWidth, y);
    }
    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text(role.company, left, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const bullet of role.bullets) {
      y = drawWrapped({
        doc,
        text: bullet,
        x: left,
        y,
        width: usableWidth,
        topMargin: top,
        bottomMargin: bottom,
        lineHeight: 4.6,
        bullet: '•',
      });
      y += 1;
    }
    y += 3;
  }

  // Skills
  if (data.skills.length > 0) {
    section(doc, 'SKILLS', left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y = drawWrapped({
      doc,
      text: data.skills.join(', '),
      x: left,
      y,
      width: usableWidth,
      topMargin: top,
      bottomMargin: bottom,
      lineHeight: 4.8,
    });
    y += 4;
  }

  // Education
  if (data.education.length > 0) {
    section(doc, 'EDUCATION', left, y);
    y += 6;
    for (const ed of data.education) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(ed.qualification, left, y);
      if (ed.dates) {
        const datesWidth = doc.getTextWidth(ed.dates);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(ed.dates, A4.w - right - datesWidth, y);
      }
      y += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.text(ed.institution, left, y);
      y += 6;
    }
  }

  // Certifications
  if (data.certifications.length > 0) {
    section(doc, 'CERTIFICATIONS', left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const c of data.certifications) {
      y = drawWrapped({
        doc,
        text: c,
        x: left,
        y,
        width: usableWidth,
        topMargin: top,
        bottomMargin: bottom,
        lineHeight: 4.8,
        bullet: '•',
      });
    }
  }

  return toBase64(doc);
}

function section(doc: import('jspdf').jsPDF, label: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(label, x, y);
  doc.setLineWidth(0.3);
  doc.line(x, y + 1.2, A4.w - 18, y + 1.2);
}
