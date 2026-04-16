'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'idle' | 'parsing' | 'starting' | 'redirecting' | 'error';
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

  async function startRewrite() {
    if (!signedIn) {
      // Redirect to sign-in, return URL = home so the form is preserved.
      router.push('/sign-in');
      return;
    }
    if (cvText.length < 50) {
      setError('Please add your CV (paste or upload a PDF/DOCX).');
      return;
    }
    if (jdText.length < 30) {
      setError('Please add the job description (paste, URL, or upload).');
      return;
    }

    setStatus('starting');
    setError(null);

    // We POST to the SSE endpoint to lock in the credit + rewriteId, but
    // the actual streaming UI lives on /rewrite/[id]. So we stash the
    // payload in sessionStorage and let the result page initiate the stream.
    const payload = {
      cvText,
      jdText,
      cvSource: { kind: cvSource },
      jdSource,
      template: 'ats-clean' as const,
      sendEmail: true,
    };
    const draftId = `draft_${Date.now().toString(36)}`;
    sessionStorage.setItem(`rewrite-payload:${draftId}`, JSON.stringify(payload));
    setStatus('redirecting');
    router.push(`/rewrite/${draftId}`);
  }

  return (
    <div className="card p-6 md:p-8">
      {/* CV input */}
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">Your CV</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => cvFileRef.current?.click()}
            className="text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
          >
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
            <span className="text-xs text-[var(--color-fg-muted)] self-center">
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
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-sm font-mono text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {/* JD input */}
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">The job description</label>
        <div className="flex gap-2 mb-3 text-xs">
          {(['paste', 'url', 'file'] as JdMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setJdMode(m)}
              className={`px-3 py-2 rounded-lg border transition-colors ${
                jdMode === m
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)] font-semibold'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
              }`}
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
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-sm font-mono text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        )}
        {jdMode === 'url' && (
          <div className="flex gap-2">
            <input
              type="url"
              value={jdUrl}
              onChange={(e) => setJdUrl(e.target.value)}
              placeholder="https://example.com/jobs/senior-product-manager"
              className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
            <button
              type="button"
              onClick={handleJdUrl}
              disabled={status === 'parsing' || !jdUrl}
              className="px-4 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm hover:bg-[var(--color-border)] disabled:opacity-40"
            >
              {status === 'parsing' ? 'Scraping…' : 'Scrape'}
            </button>
          </div>
        )}
        {jdMode === 'file' && (
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => jdFileRef.current?.click()}
              className="text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
            >
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
              <span className="text-xs text-[var(--color-fg-muted)]">
                {jdFileName} · {jdText.length.toLocaleString()} chars
              </span>
            )}
          </div>
        )}
        {jdText && jdMode !== 'paste' && (
          <details className="mt-3 text-xs text-[var(--color-fg-muted)]">
            <summary className="cursor-pointer hover:text-[var(--color-fg)]">
              Preview ({jdText.length.toLocaleString()} chars)
            </summary>
            <div className="mt-2 max-h-40 overflow-y-auto p-3 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] font-mono whitespace-pre-wrap">
              {jdText.slice(0, 1500)}
              {jdText.length > 1500 ? '…' : ''}
            </div>
          </details>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger)]/10 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={startRewrite}
        disabled={status === 'starting' || status === 'redirecting' || status === 'parsing'}
        className="w-full py-4 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {status === 'starting' || status === 'redirecting'
          ? 'Starting engine…'
          : signedIn
            ? 'Rewrite my CV →'
            : 'Sign in to start (free)'}
      </button>
      <p className="text-xs text-[var(--color-fg-dim)] mt-3 text-center">
        First rewrite is free. Then 1 free every month, or top up: 3 for £9.99 / 10 for £19.99.
      </p>
    </div>
  );
}
