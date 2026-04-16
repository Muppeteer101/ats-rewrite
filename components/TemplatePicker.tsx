'use client';

import { useState } from 'react';
import { TEMPLATES, type TemplateId } from '@/lib/pdf-templates';

export function TemplatePicker({ rewriteId }: { rewriteId: string }) {
  const [chosen, setChosen] = useState<TemplateId>('ats-clean');
  const [downloading, setDownloading] = useState(false);

  function download() {
    setDownloading(true);
    const url = `/api/pdf/${rewriteId}?template=${chosen}`;
    // Use a real link click so the browser handles the file save dialog.
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 1200);
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-1">Download your PDF</h3>
      <p className="text-sm text-[var(--color-fg-muted)] mb-4">
        We recommend the ATS-clean template — it has the highest parse rate. Pick a different one if you’re sending direct.
      </p>
      <div className="grid md:grid-cols-3 gap-3 mb-5">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setChosen(t.id)}
            className={`text-left p-4 rounded-lg border transition-colors ${
              chosen === t.id
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                : 'border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{t.label}</span>
              {t.recommended && (
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-accent-2)] border border-[var(--color-accent-2)] rounded px-1.5 py-0.5">
                  Recommended
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-fg-muted)] leading-snug">{t.description}</p>
            {t.atsRisk === 'moderate' && (
              <p className="text-[11px] text-[var(--color-warn)] mt-2">⚠ May reduce ATS pass rate</p>
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={download}
        disabled={downloading}
        className="px-5 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {downloading ? 'Preparing…' : `Download ${chosen}.pdf →`}
      </button>
    </div>
  );
}
