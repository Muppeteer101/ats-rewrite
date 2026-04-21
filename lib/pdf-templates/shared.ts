import { jsPDF } from 'jspdf';
import type { EngineResult } from '@/src/engine/schemas';

export const A4 = { w: 210, h: 297 } as const;

/**
 * Common page setup. We deliberately use the default Helvetica font (built
 * into jsPDF, no embedding required) — embedding custom fonts inflates PDFs
 * by 100kb+ and Helvetica is one of the safest fonts for ATS parsers.
 */
export function newDoc(): jsPDF {
  return new jsPDF({ unit: 'mm', format: 'a4' });
}

/** Convert a jsPDF doc into a base64 string suitable for Resend attachments. */
export function toBase64(doc: jsPDF): string {
  return doc.output('datauristring').split(',')[1];
}

/**
 * Word-wrap helper that draws lines into a region and returns the next y.
 * Handles auto-pagination — if drawing the next line would overflow the page
 * margin, addPage() is called and y resets to the top of the content area.
 */
export function drawWrapped(opts: {
  doc: jsPDF;
  text: string;
  x: number;
  y: number;
  width: number;
  topMargin: number;
  bottomMargin: number;
  lineHeight?: number;
  bullet?: string;
}): number {
  const { doc, text, x, y, width, topMargin, bottomMargin, bullet } = opts;
  const lineHeight = opts.lineHeight ?? 5;
  const lines = doc.splitTextToSize(text, width - (bullet ? 4 : 0));
  let cursor = y;
  for (let i = 0; i < lines.length; i++) {
    if (cursor > A4.h - bottomMargin) {
      doc.addPage();
      cursor = topMargin;
    }
    if (i === 0 && bullet) {
      doc.text(bullet, x, cursor);
      doc.text(lines[i], x + 4, cursor);
    } else {
      doc.text(lines[i], x + (bullet ? 4 : 0), cursor);
    }
    cursor += lineHeight;
  }
  return cursor;
}

/** Flatten a RewriteOutput into the data shape every template consumes. */
export function flatten(result: EngineResult) {
  const r = result.rewrite;
  return {
    name: r.contact.name,
    contactLine: [r.contact.email, r.contact.phone, r.contact.location]
      .filter(Boolean)
      .join('  ·  '),
    links: r.contact.links ?? [],
    summary: r.summary,
    skills: r.skills,
    roles: r.roles.map((role) => ({
      title: role.title,
      company: role.company,
      dates: role.dates,
      bullets: role.bullets,
    })),
    education: r.education ?? [],
    certifications: r.certifications ?? [],
  };
}

export type FlatCV = ReturnType<typeof flatten>;
