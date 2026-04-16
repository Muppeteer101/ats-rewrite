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
      <h3 className="sub-heading mb-1">Your CV templates</h3>
      <p className="body mb-3">
        We recommend the <strong>ATS-clean</strong> template — highest parse rate. Pick a different one if you’re sending direct.
      </p>

      {/* Already-sent notice */}
      <div
        className="mb-5 p-3 rounded-[6px] border flex items-start gap-2"
        style={{
          background: 'var(--color-success-bg)',
          borderColor: 'var(--color-success-border)',
          color: 'var(--color-success-text)',
        }}
      >
        <span style={{ marginTop: 1 }}>✓</span>
        <span className="text-sm leading-snug">
          The <strong>ATS-clean</strong> version has already been sent to your email. The previews
          below let you compare templates and download a different one if you prefer.
        </span>
      </div>

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

      {/* Live preview of the chosen template — <object> loads the actual
          PDF and falls back to an "Open in new tab" link if the browser
          can't render PDFs inline (older Safari, some mobile browsers). */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[11px] uppercase tracking-[0.14em] font-semibold"
            style={{ color: 'var(--color-purple)' }}
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
          className="rounded-[6px] border overflow-hidden"
          style={{ borderColor: 'var(--color-border)', background: '#525659' }}
        >
          <object
            // key forces the embed to remount when the chosen template
            // changes — otherwise some browsers cache the previous PDF.
            key={chosen}
            data={previewSrc}
            type="application/pdf"
            className="block w-full"
            style={{ height: '780px', border: 'none' }}
            aria-label={`${chosen} preview`}
          >
            <div className="p-8 text-center bg-white">
              <p className="body mb-4">
                Your browser can&rsquo;t show the preview inline.
              </p>
              <a
                href={`/api/pdf/${rewriteId}?template=${chosen}`}
                target="_blank"
                rel="noopener"
                className="btn btn-sm btn-primary"
              >
                Open the {chosen} PDF in a new tab →
              </a>
            </div>
          </object>
        </div>
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
