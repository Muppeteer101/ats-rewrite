'use client';

import { useState } from 'react';
import { TEMPLATES, type TemplateId } from '@/lib/pdf-templates';

export function TemplatePicker({ rewriteId }: { rewriteId: string }) {
  const [chosen, setChosen] = useState<TemplateId>('ats-clean');
  const [downloading, setDownloading] = useState(false);

  // Browser PDF viewer hash-params hide the toolbar / scrollbar / nav
  // chrome — `#toolbar=0&navpanes=0&scrollbar=0&view=FitH` makes the iframe
  // read like a clean preview of just the page.
  const previewSrc = `/api/pdf/${rewriteId}?template=${chosen}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;

  function download() {
    setDownloading(true);
    const a = document.createElement('a');
    a.href = `/api/pdf/${rewriteId}?template=${chosen}`;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 1200);
  }

  return (
    <div className="card-elevated p-7">
      <h3 className="sub-heading mb-1">Download your PDF</h3>
      <p className="body mb-5">
        We recommend the ATS-clean template — highest parse rate. Pick a different one if you’re sending direct.
      </p>

      {/* Template cards */}
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setChosen(t.id)}
            className="text-left p-4 rounded-[6px] border transition-colors"
            style={{
              borderColor: chosen === t.id ? 'var(--color-purple)' : 'var(--color-border)',
              background: chosen === t.id ? 'var(--color-purple-soft)' : 'white',
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm" style={{ color: 'var(--color-heading)', fontWeight: 400 }}>
                {t.label}
              </span>
              {t.recommended && <span className="badge badge-purple">Recommended</span>}
            </div>
            <p className="caption leading-snug">{t.description}</p>
            {t.atsRisk === 'moderate' && (
              <p className="caption mt-2" style={{ color: 'var(--color-warn-text)' }}>
                ⚠ May reduce ATS pass rate
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Live preview of the chosen template — iframe loads the actual PDF
          from /api/pdf so what you see IS what you'll download. */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--color-body)' }}
          >
            Preview · {chosen}
          </span>
          <a
            href={`/api/pdf/${rewriteId}?template=${chosen}`}
            target="_blank"
            rel="noopener"
            className="caption hover:text-[var(--color-purple)] underline decoration-dotted"
          >
            Open full size ↗
          </a>
        </div>
        <div
          className="rounded-[6px] border bg-[var(--color-surface-soft)] overflow-hidden"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <iframe
            // key forces the iframe to remount when the chosen template
            // changes — otherwise some browsers cache the previous PDF.
            key={chosen}
            src={previewSrc}
            title={`${chosen} preview`}
            className="block w-full bg-white"
            style={{ height: '720px', border: 'none' }}
          />
        </div>
        <p className="caption mt-2" style={{ color: 'var(--color-body)' }}>
          Mobile preview can be flaky — tap “Open full size” to view in your browser&rsquo;s native PDF viewer.
        </p>
      </div>

      <button
        type="button"
        onClick={download}
        disabled={downloading}
        className="btn btn-lg btn-primary disabled:opacity-50"
      >
        {downloading ? 'Preparing…' : `Download ${chosen}.pdf →`}
      </button>
    </div>
  );
}
