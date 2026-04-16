'use client';

import { useState } from 'react';
import type { CoverLetter } from '@/src/engine/schemas';

export function CoverLetterCard({
  rewriteId,
  letter,
}: {
  rewriteId: string;
  letter: CoverLetter;
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fullText = [
    letter.greeting,
    '',
    ...letter.paragraphs.flatMap((p) => [p, '']),
    letter.signoff,
    letter.signature,
  ].join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — silent */
    }
  }

  function download() {
    setDownloading(true);
    const a = document.createElement('a');
    a.href = `/api/pdf/${rewriteId}?template=cover-letter`;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 1200);
  }

  return (
    <div className="card-elevated p-7">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="sub-heading mb-1">Cover letter</h3>
          <p className="caption">Drafted in your CV’s voice. Built around real achievements only.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={copy} className="btn btn-sm btn-neutral">
            {copied ? 'Copied ✓' : 'Copy text'}
          </button>
          <button type="button" onClick={download} disabled={downloading} className="btn btn-sm btn-primary">
            {downloading ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div
        className="rounded-[6px] border border-[var(--color-border)] p-6 bg-white"
        style={{ color: 'var(--color-heading)', lineHeight: 1.6, fontSize: '15px' }}
      >
        <p style={{ margin: '0 0 14px' }}>{letter.greeting}</p>
        {letter.paragraphs.map((p, i) => (
          <p key={i} style={{ margin: '0 0 14px' }}>
            {p}
          </p>
        ))}
        <p style={{ margin: '0 0 4px' }}>{letter.signoff}</p>
        <p style={{ margin: 0, fontWeight: 500 }}>{letter.signature}</p>
      </div>
    </div>
  );
}
