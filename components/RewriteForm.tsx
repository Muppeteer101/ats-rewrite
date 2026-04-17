'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'idle' | 'parsing' | 'analyzing' | 'gap-confirm' | 'starting' | 'redirecting' | 'error';
type JdMode = 'paste' | 'url' | 'file';

export function RewriteForm({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const cvFileRef = useRef<HTMLInputElement>(null);
  const jdFileRef = useRef<HTMLInputElement>(null);

  const [cvText, setCvText] = useState('');
  const [cvSource, setCvSource] = useState<'text' | 'pdf' | 'docx'>('text');
  const [cvFileName, setCvFileName] = useState<string | null>(null);

  const [jdMode, setJdMode] = useState<JdMode>('paste');
  const [jdText, setJdText] = useState('');
  const [jdUrl, setJdUrl] = useState('');
  const [jdSource, setJdSource] = useState<{ kind: 'text' | 'pdf' | 'docx' | 'url'; url?: string }>({
    kind: 'text',
  });
  const [jdFileName, setJdFileName] = useState<string | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [includeCoverLetter, setIncludeCoverLetter] = useState(false);

  // Gap-confirm step state
  const [detectedGaps, setDetectedGaps] = useState<string[]>([]);
  const [confirmedGaps, setConfirmedGaps] = useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [preAnalysis, setPreAnalysis] = useState<any>(null);

  async function handleCvFile(file: File) {
    setStatus('parsing');
    setError(null);
    setCvFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/parse-cv', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to parse CV');
      setCvText(data.text);
      setCvSource(data.kind);
      setStatus('idle');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }

  async function handleJdFile(file: File) {
    setStatus('parsing');
    setError(null);
    setJdFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/parse-jd', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to parse JD');
      setJdText(data.text);
      setJdSource({ kind: data.kind });
      setStatus('idle');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }

  async function handleJdUrl() {
    if (!jdUrl) return;
    setStatus('parsing');
    setError(null);
    try {
      const res = await fetch('/api/parse-jd', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: jdUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to scrape JD');
      setJdText(data.text);
      setJdSource({ kind: 'url', url: jdUrl.trim() });
      setStatus('idle');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }

  function validateInputs(): boolean {
    if (!signedIn) { router.push('/sign-in'); return false; }
    if (cvText.length < 50) { setError('Please add your CV (paste or upload a PDF/DOCX).'); return false; }
    if (jdText.length < 30) { setError('Please add the job description (paste, URL, or upload).'); return false; }
    return true;
  }

  function launchRewrite(extraSkills: string[], analysis: unknown) {
    const payload = {
      cvText,
      jdText,
      cvSource: { kind: cvSource },
      jdSource,
      template: 'ats-clean' as const,
      sendEmail: true,
      includeCoverLetter,
      preAnalysis: analysis,
      extraSkills,
    };
    const draftId = `draft_${Date.now().toString(36)}`;
    sessionStorage.setItem(`rewrite-payload:${draftId}`, JSON.stringify(payload));
    setStatus('redirecting');
    router.push(`/rewrite/${draftId}`);
  }

  async function startRewrite() {
    if (!validateInputs()) return;
    setStatus('analyzing');
    setError(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cvText, jdText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed');

      if (data.gaps?.length > 0) {
        setDetectedGaps(data.gaps);
        setConfirmedGaps(new Set(data.gaps)); // all checked by default
        setPreAnalysis(data.preAnalysis);
        setStatus('gap-confirm');
      } else {
        // No gaps — skip confirmation and go straight to rewrite
        setStatus('starting');
        launchRewrite([], data.preAnalysis);
      }
    } catch (e) {
      // Analysis failed — fall back to running Pass 1+2 inside the engine
      setStatus('starting');
      launchRewrite([], null);
    }
  }

  function confirmGapsAndRewrite() {
    setStatus('starting');
    launchRewrite([...confirmedGaps], preAnalysis);
  }

  function skipGapsAndRewrite() {
    setStatus('starting');
    launchRewrite([], preAnalysis);
  }

  function toggleGap(gap: string) {
    setConfirmedGaps((prev) => {
      const next = new Set(prev);
      if (next.has(gap)) next.delete(gap);
      else next.add(gap);
      return next;
    });
  }

  const helperBtn =
    'text-xs px-3 py-2 rounded-[4px] border border-[var(--color-border)] bg-white text-[var(--color-heading)] hover:bg-[var(--color-surface-soft)] transition-colors';

  return (
    <div className="card-elevated p-6 md:p-8">
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-label)' }}>
          Your CV
        </label>
        <div className="flex gap-2 mb-3 items-center">
          <button type="button" onClick={() => cvFileRef.current?.click()} className={helperBtn}>
            Upload PDF / DOCX
          </button>
          <input
            ref={cvFileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => e.target.files?.[0] && handleCvFile(e.target.files[0])}
            className="hidden"
          />
          {cvFileName && (
            <span className="caption tabular">
              {cvFileName} · {cvText.length.toLocaleString()} chars
            </span>
          )}
        </div>
        <textarea
          value={cvText}
          onChange={(e) => {
            setCvText(e.target.value);
            setCvSource('text');
            setCvFileName(null);
          }}
          rows={6}
          placeholder="…or paste your CV text here."
          className="textarea"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-label)' }}>
          The job description
        </label>
        <div className="flex gap-2 mb-3 text-xs">
          {(['paste', 'url', 'file'] as JdMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setJdMode(m)}
              className={
                jdMode === m
                  ? 'px-3 py-2 rounded-[4px] bg-[var(--color-purple)] text-white border border-[var(--color-purple)]'
                  : helperBtn
              }
            >
              {m === 'paste' ? 'Paste' : m === 'url' ? 'URL' : 'Upload'}
            </button>
          ))}
        </div>
        {jdMode === 'paste' && (
          <textarea
            value={jdText}
            onChange={(e) => {
              setJdText(e.target.value);
              setJdSource({ kind: 'text' });
              setJdFileName(null);
            }}
            rows={6}
            placeholder="Paste the full job posting here."
            className="textarea"
          />
        )}
        {jdMode === 'url' && (
          <div className="flex gap-2">
            <input
              type="url"
              value={jdUrl}
              onChange={(e) => setJdUrl(e.target.value)}
              placeholder="https://example.com/jobs/senior-product-manager"
              className="input"
            />
            <button
              type="button"
              onClick={handleJdUrl}
              disabled={status === 'parsing' || !jdUrl}
              className="btn btn-sm btn-neutral disabled:opacity-40"
            >
              {status === 'parsing' ? 'Scraping…' : 'Scrape'}
            </button>
          </div>
        )}
        {jdMode === 'file' && (
          <div className="flex gap-2 items-center">
            <button type="button" onClick={() => jdFileRef.current?.click()} className={helperBtn}>
              Upload PDF / DOCX
            </button>
            <input
              ref={jdFileRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => e.target.files?.[0] && handleJdFile(e.target.files[0])}
              className="hidden"
            />
            {jdFileName && (
              <span className="caption tabular">
                {jdFileName} · {jdText.length.toLocaleString()} chars
              </span>
            )}
          </div>
        )}
        {jdText && jdMode !== 'paste' && (
          <details className="mt-3 caption">
            <summary className="cursor-pointer hover:text-[var(--color-heading)]">
              Preview ({jdText.length.toLocaleString()} chars)
            </summary>
            <div className="mt-2 max-h-40 overflow-y-auto p-3 bg-[var(--color-surface-soft)] rounded-[4px] border border-[var(--color-border)] font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
              {jdText.slice(0, 1500)}
              {jdText.length > 1500 ? '…' : ''}
            </div>
          </details>
        )}
      </div>

      <label className="flex items-start gap-3 mb-5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={includeCoverLetter}
          onChange={(e) => setIncludeCoverLetter(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-purple)] cursor-pointer"
        />
        <span className="text-sm leading-snug" style={{ color: 'var(--color-heading)' }}>
          <span style={{ fontWeight: 500 }}>Also draft a tailored cover letter</span>
          <span className="block text-xs mt-0.5" style={{ color: 'var(--color-body)' }}>
            Voice-matched, built around the same JD analysis. Adds ~15s + a small amount to the engine cost.
          </span>
        </span>
      </label>

      {error && (
        <div className="mb-4 p-3 rounded-[4px] border" style={{ background: 'rgba(234,34,97,0.06)', borderColor: 'rgba(234,34,97,0.3)', color: 'var(--color-ruby)' }}>
          <span className="text-sm">{error}</span>
        </div>
      )}

      {status === 'gap-confirm' && (
        <div className="mb-5 p-4 rounded-[6px] border" style={{ background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.25)' }}>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-heading)' }}>
            A few JD keywords weren&apos;t found literally in your CV
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--color-body)' }}>
            Given your experience level, you almost certainly have this experience. Tick any you want the rewrite to explicitly surface:
          </p>
          <div className="space-y-2 mb-4">
            {detectedGaps.map((gap) => (
              <label key={gap} className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmedGaps.has(gap)}
                  onChange={() => toggleGap(gap)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-purple)] cursor-pointer flex-shrink-0"
                />
                <span className="text-sm leading-snug" style={{ color: 'var(--color-heading)' }}>{gap}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmGapsAndRewrite}
              className="btn btn-sm btn-primary"
            >
              Include selected →
            </button>
            <button
              type="button"
              onClick={skipGapsAndRewrite}
              className="btn btn-sm btn-neutral"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {status !== 'gap-confirm' && (
        <button
          type="button"
          onClick={startRewrite}
          disabled={status === 'analyzing' || status === 'starting' || status === 'redirecting' || status === 'parsing'}
          className="btn btn-lg btn-primary w-full disabled:opacity-50"
        >
          {status === 'analyzing'
            ? 'Analysing your CV…'
            : status === 'starting' || status === 'redirecting'
              ? 'Starting engine…'
              : signedIn
                ? 'Rewrite my CV →'
                : 'Sign in to start (free)'}
        </button>
      )}
      <p className="caption mt-3 text-center">
        First rewrite is free. Then 1 free every month, or top up: 3 for £9.99 / 10 for £19.99.
      </p>
    </div>
  );
}
