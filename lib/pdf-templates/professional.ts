import { newDoc, toBase64, drawWrapped, flatten, A4 } from './shared';
import type { EngineResult } from '@/src/engine/schemas';

/**
 * Professional template — single column (still ATS-safe), but with a thin
 * accent rule above the name and slightly more typographic hierarchy.
 *
 * Trade-off vs ats-clean: marginally more "designed" feel; same parse rate
 * because the structure is still single-column with plain section labels.
 */
export function renderProfessional(result: EngineResult): string {
  const doc = newDoc();
  const data = flatten(result);
  const ACCENT: [number, number, number] = [40, 40, 40];

  const left = 20;
  const right = 20;
  const top = 16;
  const bottom = 18;
  const usableWidth = A4.w - left - right;
  let y = top;

  // Accent rule + name
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.2);
  doc.line(left, y, left + 30, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...ACCENT);
  doc.text(data.name || 'Candidate', left, y);
  y += 7;

  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (data.contactLine) {
    doc.text(data.contactLine, left, y);
    y += 5;
  }
  if (data.links.length > 0) {
    doc.text(data.links.join('  ·  '), left, y);
    y += 5;
  }
  doc.setTextColor(20, 20, 20);
  y += 4;

  if (data.summary) {
    section(doc, 'Summary', left, y, ACCENT);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    y = drawWrapped({ doc, text: data.summary, x: left, y, width: usableWidth, topMargin: top, bottomMargin: bottom, lineHeight: 5 });
    y += 5;
  }

  section(doc, 'Experience', left, y, ACCENT);
  y += 6;
  for (const role of data.roles) {
    if (y > A4.h - bottom - 22) {
      doc.addPage();
      y = top;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(role.title, left, y);
    if (role.dates) {
      const w = doc.getTextWidth(role.dates);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(95, 95, 95);
      doc.text(role.dates, A4.w - right - w, y);
      doc.setTextColor(20, 20, 20);
    }
    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10.5);
    doc.setTextColor(70, 70, 70);
    doc.text(role.company, left, y);
    doc.setTextColor(20, 20, 20);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const bullet of role.bullets) {
      y = drawWrapped({ doc, text: bullet, x: left, y, width: usableWidth, topMargin: top, bottomMargin: bottom, lineHeight: 4.7, bullet: '•' });
      y += 1;
    }
    y += 4;
  }

  if (data.skills.length > 0) {
    section(doc, 'Core skills', left, y, ACCENT);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y = drawWrapped({ doc, text: data.skills.join(' · '), x: left, y, width: usableWidth, topMargin: top, bottomMargin: bottom, lineHeight: 4.8 });
    y += 4;
  }

  if (data.education.length > 0) {
    section(doc, 'Education', left, y, ACCENT);
    y += 6;
    for (const ed of data.education) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(ed.qualification, left, y);
      if (ed.dates) {
        const w = doc.getTextWidth(ed.dates);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(95, 95, 95);
        doc.text(ed.dates, A4.w - right - w, y);
        doc.setTextColor(20, 20, 20);
      }
      y += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(70, 70, 70);
      doc.text(ed.institution, left, y);
      doc.setTextColor(20, 20, 20);
      y += 6;
    }
  }

  if (data.certifications.length > 0) {
    section(doc, 'Certifications', left, y, ACCENT);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const c of data.certifications) {
      y = drawWrapped({ doc, text: c, x: left, y, width: usableWidth, topMargin: top, bottomMargin: bottom, lineHeight: 4.8, bullet: '•' });
    }
  }

  return toBase64(doc);
}

function section(doc: import('jspdf').jsPDF, label: string, x: number, y: number, accent: [number, number, number]) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...accent);
  doc.text(label.toUpperCase(), x, y);
  doc.setTextColor(20, 20, 20);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(x, y + 1.4, A4.w - 20, y + 1.4);
}
