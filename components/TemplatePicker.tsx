'use client';

import { useState } from 'react';
import { TEMPLATES, type TemplateId } from '@/lib/pdf-templates';

export function TemplatePicker({ rewriteId }: { rewriteId: string }) {
  const [chosen, setChosen] = useState<TemplateId>('ats-clean');
  const [downloading, setDownloading] = useState(false);

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
