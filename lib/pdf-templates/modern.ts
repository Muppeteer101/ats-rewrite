import { newDoc, toBase64, drawWrapped, flatten, A4 } from './shared';
import type { EngineResult } from '@/src/engine/schemas';

/**
 * Modern template — left sidebar for contact + skills + education,
 * right column for summary + experience.
 *
 * ⚠ ATS WARNING: multi-column layouts can confuse older ATS parsers.
 * The TemplatePicker UI flags this template as "may reduce ATS pass rate" —
 * we offer it because some users want a more visually-distinctive doc to send
 * to specific recruiters / via human channels (LinkedIn DM, intro emails).
 *
 * To minimise the damage we render the sidebar as plain TEXT positioned
 * with absolute coordinates (no actual table cells), so flatteners that
 * read top-to-bottom-left-to-right still get the contact + skills first.
 */
export function renderModern(result: EngineResult): string {
  const doc = newDoc();
  const data = flatten(result);
  const ACCENT: [number, number, number] = [255, 107, 107]; // brand coral

  const sidebarLeft = 14;
  const sidebarWidth = 60;
  const mainLeft = 84;
  const mainRight = 16;
  const top = 18;
  const bottom = 18;
  const mainWidth = A4.w - mainLeft - mainRight;

  // Soft sidebar background
  doc.setFillColor(245, 245, 248);
  doc.rect(0, 0, sidebarLeft + sidebarWidth + 4, A4.h, 'F');

  // ── Sidebar ─────────────────────────────────────
  let sy = top;
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  // Stack first/last name if it fits in the sidebar; otherwise wrap.
  sy = drawWrapped({ doc, text: data.name || 'Candidate', x: sidebarLeft, y: sy + 4, width: sidebarWidth, topMargin: top, bottomMargin: bottom, lineHeight: 6.5 });
  sy += 4;

  sidebarHeading(doc, 'Contact', sidebarLeft, sy, ACCENT);
  sy += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (data.contactLine) {
    sy = drawWrapped({ doc, text: data.contactLine, x: sidebarLeft, y: sy, width: sidebarWidth, topMargin: top, bottomMargin: bottom, lineHeight: 4.2 });
  }
  for (const link of data.links) {
    sy = drawWrapped({ doc, text: link, x: sidebarLeft, y: sy + 1, width: sidebarWidth, topMargin: top, bottomMargin: bottom, lineHeight: 4.2 });
  }
  sy += 4;

  if (data.skills.length > 0) {
    sidebarHeading(doc, 'Skills', sidebarLeft, sy, ACCENT);
    sy += 5;
    doc.setFontSize(9);
    for (const s of data.skills) {
      sy = drawWrapped({ doc, text: s, x: sidebarLeft, y: sy, width: sidebarWidth, topMargin: top, bottomMargin: bottom, lineHeight: 4.2, bullet: '•' });
      sy += 0.5;
    }
    sy += 4;
  }

  if (data.education.length > 0) {
    sidebarHeading(doc, 'Education', sidebarLeft, sy, ACCENT);
    sy += 5;
    for (const ed of data.education) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      sy = drawWrapped({ doc, text: ed.qualification, x: sidebarLeft, y: sy, width: sidebarWidth, topMargin: top, bottomMargin: bottom, lineHeight: 4.2 });
      doc.setFont('helvetica', 'italic');
      sy = drawWrapped({ doc, text: ed.institution, x: sidebarLeft, y: sy, width: sidebarWidth, topMargin: top, bottomMargin: bottom, lineHeight: 4.2 });
      if (ed.dates) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(110, 110, 110);
        sy = drawWrapped({ doc, text: ed.dates, x: sidebarLeft, y: sy, width: sidebarWidth, topMargin: top, bottomMargin: bottom, lineHeight: 4.2 });
        doc.setTextColor(20, 20, 20);
      }
      sy += 2;
    }
  }

  if (data.certifications.length > 0) {
    sidebarHeading(doc, 'Certifications', sidebarLeft, sy, ACCENT);
    sy += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const c of data.certifications) {
      sy = drawWrapped({ doc, text: c, x: sidebarLeft, y: sy, width: sidebarWidth, topMargin: top, bottomMargin: bottom, lineHeight: 4.2, bullet: '•' });
    }
  }

  // ── Main column ─────────────────────────────────
  let y = top;
  if (data.summary) {
    mainHeading(doc, 'Summary', mainLeft, y, ACCENT);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    y = drawWrapped({ doc, text: data.summary, x: mainLeft, y, width: mainWidth, topMargin: top, bottomMargin: bottom, lineHeight: 5 });
    y += 5;
  }

  mainHeading(doc, 'Experience', mainLeft, y, ACCENT);
  y += 6;
  for (const role of data.roles) {
    if (y > A4.h - bottom - 22) {
      doc.addPage();
      y = top;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(role.title, mainLeft, y);
    if (role.dates) {
      const w = doc.getTextWidth(role.dates);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(110, 110, 110);
      doc.text(role.dates, A4.w - mainRight - w, y);
      doc.setTextColor(20, 20, 20);
    }
    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(role.company, mainLeft, y);
    doc.setTextColor(20, 20, 20);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const bullet of role.bullets) {
      y = drawWrapped({ doc, text: bullet, x: mainLeft, y, width: mainWidth, topMargin: top, bottomMargin: bottom, lineHeight: 4.7, bullet: '•' });
      y += 1;
    }
    y += 4;
  }

  return toBase64(doc);
}

function sidebarHeading(doc: import('jspdf').jsPDF, label: string, x: number, y: number, accent: [number, number, number]) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...accent);
  doc.text(label.toUpperCase(), x, y);
  doc.setTextColor(20, 20, 20);
}

function mainHeading(doc: import('jspdf').jsPDF, label: string, x: number, y: number, accent: [number, number, number]) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...accent);
  doc.text(label.toUpperCase(), x, y);
  doc.setTextColor(20, 20, 20);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.4);
  doc.line(x, y + 1.6, x + 14, y + 1.6);
}
