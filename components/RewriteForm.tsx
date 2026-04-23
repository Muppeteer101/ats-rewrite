'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'idle' | 'parsing' | 'starting' | 'redirecting' | 'error';
type JdMode = 'paste' | 'url' | 'file';

/**
 * Landing-page form — Resume + job description capture.
 *
 * No gap-confirm, no cover-letter opt-in: the six-pass engine runs the full
 * pipeline every time and always produces a cover letter as part of Pass 5.
 *
 * On submit we stash the payload in sessionStorage under a draft ID and
 * navigate to /rewrite/<draftId>, which runs the engine and renders results.
 * The draft ID survives a Stripe Checkout round-trip so a mid-rewrite top-up
 * lands the user back on the same draft page and resumes automatically.
 */
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
      if (!res.ok) throw new Error(data.error ?? 'Failed to parse resume');
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
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch JD from URL');
      setJdText(data.text);
      setJdSource({ kind: 'url', url: jdUrl.trim() });
      setStatus('idle');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }

  function startRewrite() {
    if (!signedIn) { router.push('/sign-in'); return; }
    if (cvText.length < 50) { setError('Please add your resume (paste or upload a PDF/DOCX).'); return; }
    if (jdText.length < 30) { setError('Please add the job description (paste, URL, or upload).'); return; }

    setStatus('starting');
    setError(null);

    const payload = {
      cvText,
      jdText,
      cvSource: { kind: cvSource },
      jdSource,
      template: 'ats-clean' as const,
      sendEmail: true,
    };
    // Base36 for predictable length so the checkout route's whitelist regex
    // matches every ID RewriteForm produces.
    const draftId = `draft_${Date.now().toString(36)}`;
    sessionStorage.setItem(`rewrite-payload:${draftId}`, JSON.stringify(payload));
    setStatus('redirecting');
    router.push(`/rewrite/${draftId}`);
  }

  const cvChars = cvText.length;
  const jdChars = jdText.length;
  const cvReady = cvChars >= 50;
  const jdReady = jdChars >= 30;
  const busy = status === 'starting' || status === 'redirecting' || status === 'parsing';

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e7e8ef',
    borderRadius: 14,
    padding: 28,
    boxShadow: '0 2px 6px -2px rgba(15,15,26,0.04)',
  };
  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: 14,
    border: '1px solid #e7e8ef',
    borderRadius: 10,
    fontFamily: 'inherit',
    fontSize: 14,
    lineHeight: 1.55,
    resize: 'vertical',
    outline: 'none',
    background: '#fff',
    color: '#0f0f1a',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="rf-grid" style={{ display: 'grid', gap: 20 }}>
        {/* ─────────── Resume ─────────── */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 600, color: '#0f0f1a', margin: 0 }}>Your resume</h2>
              <p style={{ fontSize: 13, color: '#7a7c95', margin: '4px 0 0' }}>Upload a PDF, DOCX, or paste the text.</p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: cvReady ? '#22c55e' : '#7a7c95', whiteSpace: 'nowrap' }}>
              ● {cvReady ? 'READY' : 'REQUIRED'}
            </span>
          </div>

          <div
            onClick={() => cvFileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void handleCvFile(f); }}
            style={{
              border: '2px dashed ' + (cvFileName ? '#b8a3ff' : '#cfd2e0'),
              borderRadius: 10,
              padding: cvFileName ? 16 : 24,
              textAlign: 'center',
              background: cvFileName ? '#f8f5ff' : '#fafbff',
              marginBottom: 14,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {cvFileName ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#0f0f1a', margin: '0 0 2px' }}>📄 {cvFileName}</p>
                <p style={{ fontSize: 12, color: '#7a7c95', margin: 0 }}>
                  {cvChars.toLocaleString()} chars parsed · <span style={{ color: '#7c3aed' }}>click to replace</span>
                </p>
              </>
            ) : (
              <>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block' }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f1a', margin: '0 0 4px' }}>Drop your PDF or DOCX here</p>
                <p style={{ fontSize: 13, color: '#7a7c95', margin: 0 }}>
                  or <span style={{ color: '#7c3aed', fontWeight: 600 }}>click to browse</span> · max 10&nbsp;MB
                </p>
              </>
            )}
            <input
              ref={cvFileRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => e.target.files?.[0] && handleCvFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b0b3c9', fontSize: 12, margin: '12px 0' }}>
            <span style={{ flex: 1, height: 1, background: '#e7e8ef' }} />
            <span>OR PASTE</span>
            <span style={{ flex: 1, height: 1, background: '#e7e8ef' }} />
          </div>

          <textarea
            value={cvText}
            onChange={(e) => { setCvText(e.target.value); setCvSource('text'); setCvFileName(null); }}
            placeholder="Paste your resume text here. We'll parse roles, bullets, skills, education, and dates."
            style={{ ...textareaStyle, minHeight: 160 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#7a7c95' }}>
            <span>Any length is fine — the engine handles long careers.</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: cvReady ? '#22c55e' : '#7a7c95' }}>
              {cvChars.toLocaleString()} / 50 min
            </span>
          </div>
        </section>

        {/* ─────────── Job description ─────────── */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 600, color: '#0f0f1a', margin: 0 }}>The job description</h2>
              <p style={{ fontSize: 13, color: '#7a7c95', margin: '4px 0 0' }}>Paste, link to a URL, or upload the posting.</p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: jdReady ? '#22c55e' : '#7a7c95', whiteSpace: 'nowrap' }}>
              ● {jdReady ? 'READY' : 'REQUIRED'}
            </span>
          </div>

          <div
            role="tablist"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 4,
              background: '#f2f2f8',
              padding: 4,
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            {(['paste', 'url', 'file'] as JdMode[]).map((m) => {
              const active = jdMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setJdMode(m)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 7,
                    border: 'none',
                    background: active ? '#fff' : 'transparent',
                    color: active ? '#0f0f1a' : '#7a7c95',
                    fontWeight: active ? 600 : 500,
                    fontSize: 14,
                    cursor: 'pointer',
                    boxShadow: active ? '0 1px 3px rgba(15,15,26,0.08)' : 'none',
                    transition: 'all 150ms ease',
                  }}
                >
                  {m === 'paste' ? 'Paste' : m === 'url' ? 'URL' : 'Upload'}
                </button>
              );
            })}
          </div>

          {jdMode === 'paste' && (
            <>
              <textarea
                value={jdText}
                onChange={(e) => { setJdText(e.target.value); setJdSource({ kind: 'text' }); setJdFileName(null); }}
                placeholder="Paste the full job description here — role, responsibilities, must-haves, nice-to-haves."
                style={{ ...textareaStyle, minHeight: 220 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#7a7c95' }}>
                <span>Longer JDs give better matches — don&apos;t trim.</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: jdReady ? '#22c55e' : '#7a7c95' }}>
                  {jdChars.toLocaleString()} / 200 min
                </span>
              </div>
            </>
          )}

          {jdMode === 'url' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  value={jdUrl}
                  onChange={(e) => setJdUrl(e.target.value)}
                  placeholder="https://… (LinkedIn, Indeed, company careers page)"
                  style={{ flex: 1, padding: '12px 14px', border: '1px solid #e7e8ef', borderRadius: 10, fontSize: 14, outline: 'none', background: '#fff', color: '#0f0f1a' }}
                />
                <button
                  type="button"
                  onClick={handleJdUrl}
                  disabled={status === 'parsing' || !jdUrl}
                  style={{
                    padding: '12px 20px',
                    background: '#7c3aed',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: (status === 'parsing' || !jdUrl) ? 'not-allowed' : 'pointer',
                    opacity: (status === 'parsing' || !jdUrl) ? 0.5 : 1,
                  }}
                >
                  {status === 'parsing' ? 'Analysing…' : 'Analyse'}
                </button>
              </div>
              {jdText && (
                <details style={{ marginTop: 14, fontSize: 12, color: '#7a7c95' }}>
                  <summary style={{ cursor: 'pointer' }}>Preview ({jdChars.toLocaleString()} chars)</summary>
                  <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto', padding: 12, background: '#fafbff', borderRadius: 8, border: '1px solid #e7e8ef', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {jdText.slice(0, 1500)}{jdText.length > 1500 ? '…' : ''}
                  </div>
                </details>
              )}
            </>
          )}

          {jdMode === 'file' && (
            <>
              <div
                onClick={() => jdFileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void handleJdFile(f); }}
                style={{
                  border: '2px dashed ' + (jdFileName ? '#b8a3ff' : '#cfd2e0'),
                  borderRadius: 10,
                  padding: jdFileName ? 16 : 24,
                  textAlign: 'center',
                  background: jdFileName ? '#f8f5ff' : '#fafbff',
                  cursor: 'pointer',
                }}
              >
                {jdFileName ? (
                  <>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#0f0f1a', margin: '0 0 2px' }}>📄 {jdFileName}</p>
                    <p style={{ fontSize: 12, color: '#7a7c95', margin: 0 }}>{jdChars.toLocaleString()} chars parsed · <span style={{ color: '#7c3aed' }}>click to replace</span></p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f1a', margin: '0 0 4px' }}>Drop the job posting PDF/DOCX</p>
                    <p style={{ fontSize: 13, color: '#7a7c95', margin: 0 }}>or <span style={{ color: '#7c3aed', fontWeight: 600 }}>click to browse</span></p>
                  </>
                )}
                <input
                  ref={jdFileRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => e.target.files?.[0] && handleJdFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </div>
            </>
          )}
        </section>
      </div>

      {error && (
        <div style={{ padding: 14, borderRadius: 10, background: 'rgba(234,34,97,0.06)', border: '1px solid rgba(234,34,97,0.3)', color: '#ea2261', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* ─────────── Action row ─────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0b1430 0%, #1a1240 100%)',
          border: '1px solid rgba(184,163,255,0.18)',
          borderRadius: 14,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 20px 60px -30px rgba(5,8,24,0.5)',
        }}
      >
        <div style={{ flex: '1 1 280px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f4f0ff', margin: 0 }}>
            {cvReady && jdReady ? 'Ready when you are' : 'Add your resume and the JD to continue'}
          </h3>
          <p style={{ fontSize: 13, color: '#b5b8d6', margin: '4px 0 0', lineHeight: 1.5 }}>
            Match score · recruiter verdict · ATS confidence · gap confirmation · rewrite + cover letter. <strong style={{ color: '#fff' }}>First rewrite is free.</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={startRewrite}
          disabled={busy}
          style={{
            padding: '14px 28px',
            background: busy
              ? 'rgba(184,163,255,0.3)'
              : 'linear-gradient(135deg, #b8a3ff 0%, #f96bee 100%)',
            color: '#0f0f1a',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.01em',
            cursor: busy ? 'not-allowed' : 'pointer',
            boxShadow: busy ? 'none' : '0 6px 20px -6px rgba(249,107,238,0.6)',
            opacity: busy ? 0.7 : 1,
            transition: 'all 150ms ease',
          }}
        >
          {status === 'starting' || status === 'redirecting'
            ? 'Starting engine…'
            : signedIn
              ? 'Run the full analysis →'
              : 'Sign in to start (free)'}
        </button>
      </div>

      <p style={{ fontSize: 12, color: '#7a7c95', textAlign: 'center', margin: 0 }}>
        By submitting you agree to the analysis being processed by Anthropic Claude. Your files never leave Vercel infrastructure.
      </p>

      {/* Responsive two-column: desktop side-by-side, mobile stacked */}
      <style>{`
        @media (min-width: 900px) {
          .rf-grid { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
        }
      `}</style>
    </div>
  );
}
