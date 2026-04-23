/* eslint-disable @next/next/no-html-link-for-pages */
/**
 * /mock-start — visual mockup of the proposed new "Start your rewrite" form.
 * Not wired to the engine. Purely visual, for design review. Delete after sign-off.
 */

export const metadata = { title: 'Mock · Start your rewrite' };

export default function MockStartPage() {
  return (
    <main style={{ background: '#f4f4f7', minHeight: '100vh', padding: '48px 24px 80px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#7a7c95', fontSize: 13, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
          <span style={{ width: 24, height: 1, background: '#b8a3ff' }} />
          Step 1 of 4 · Start
        </div>
        <h1 style={{ fontSize: 44, fontWeight: 300, letterSpacing: '-0.02em', color: '#0f0f1a', margin: 0, lineHeight: 1.1 }}>
          Start your rewrite
        </h1>
        <p style={{ fontSize: 17, color: '#5f6385', marginTop: 12, marginBottom: 36, maxWidth: 640, lineHeight: 1.55 }}>
          Drop in your resume and the job description you&apos;re targeting.
          We&apos;ll run the full analysis — then ask you to confirm any gaps before scoring you again. No payment until the rewrite.
        </p>

        {/* Two-column card */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 20,
            marginBottom: 20,
          }}
        >
          {/* ─────────── Resume column ─────────── */}
          <section
            style={{
              background: '#fff',
              border: '1px solid #e7e8ef',
              borderRadius: 14,
              padding: 28,
              boxShadow: '0 2px 6px -2px rgba(15,15,26,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 600, color: '#0f0f1a', margin: 0 }}>Your resume</h2>
                <p style={{ fontSize: 13, color: '#7a7c95', margin: '4px 0 0' }}>Upload a PDF, DOCX, or paste the text.</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#22c55e' }}>● REQUIRED</span>
            </div>

            {/* Dropzone */}
            <div
              style={{
                border: '2px dashed #cfd2e0',
                borderRadius: 10,
                padding: 24,
                textAlign: 'center',
                background: '#fafbff',
                marginBottom: 16,
                transition: 'all 150ms ease',
                cursor: 'pointer',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" style={{ margin: '0 auto 10px', display: 'block' }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f1a', margin: '0 0 4px' }}>Drop your PDF or DOCX here</p>
              <p style={{ fontSize: 13, color: '#7a7c95', margin: 0 }}>or <span style={{ color: '#7c3aed', fontWeight: 600 }}>click to browse</span> · max 10&nbsp;MB</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b0b3c9', fontSize: 12, margin: '14px 0' }}>
              <span style={{ flex: 1, height: 1, background: '#e7e8ef' }} />
              <span>OR PASTE</span>
              <span style={{ flex: 1, height: 1, background: '#e7e8ef' }} />
            </div>

            <textarea
              placeholder="Paste your resume text here. We'll parse roles, bullets, skills, education, and dates."
              style={{
                width: '100%',
                minHeight: 160,
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
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#7a7c95' }}>
              <span>Tip: any length is fine — the engine handles long careers.</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>0 / 50 min</span>
            </div>
          </section>

          {/* ─────────── Job description column ─────────── */}
          <section
            style={{
              background: '#fff',
              border: '1px solid #e7e8ef',
              borderRadius: 14,
              padding: 28,
              boxShadow: '0 2px 6px -2px rgba(15,15,26,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 600, color: '#0f0f1a', margin: 0 }}>The job description</h2>
                <p style={{ fontSize: 13, color: '#7a7c95', margin: '4px 0 0' }}>Paste, link to a URL, or upload the posting.</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#22c55e' }}>● REQUIRED</span>
            </div>

            {/* Segmented tabs */}
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
              {[
                { label: 'Paste', active: true },
                { label: 'URL', active: false },
                { label: 'Upload', active: false },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 7,
                    border: 'none',
                    background: t.active ? '#fff' : 'transparent',
                    color: t.active ? '#0f0f1a' : '#7a7c95',
                    fontWeight: t.active ? 600 : 500,
                    fontSize: 14,
                    cursor: 'pointer',
                    boxShadow: t.active ? '0 1px 3px rgba(15,15,26,0.08)' : 'none',
                    transition: 'all 150ms ease',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Paste the full job description here — role, responsibilities, must-haves, nice-to-haves."
              style={{
                width: '100%',
                minHeight: 220,
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
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#7a7c95' }}>
              <span>Longer JDs give better matches — don&apos;t trim.</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>0 / 200 min</span>
            </div>

          </section>
        </div>

        {/* Action row */}
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
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f4f0ff', margin: 0 }}>Ready when you are</h3>
            <p style={{ fontSize: 13, color: '#b5b8d6', margin: '4px 0 0', lineHeight: 1.5 }}>
              Match score · recruiter verdict · ATS confidence · gap confirmation · rewrite + cover letter. <strong style={{ color: '#fff' }}>First rewrite is free.</strong>
            </p>
          </div>
          <button
            type="button"
            style={{
              padding: '14px 28px',
              background: 'linear-gradient(135deg, #b8a3ff 0%, #f96bee 100%)',
              color: '#0f0f1a',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.01em',
              cursor: 'pointer',
              boxShadow: '0 6px 20px -6px rgba(249,107,238,0.6)',
            }}
          >
            Run the full analysis →
          </button>
        </div>

        <p style={{ fontSize: 12, color: '#7a7c95', textAlign: 'center', marginTop: 16 }}>
          By submitting you agree to the analysis being processed by Anthropic Claude. Your files never leave Vercel infrastructure.
        </p>

        {/* Annotation block for review */}
        <div style={{ marginTop: 48, padding: 20, background: '#fff8e6', border: '1px solid #f0c969', borderRadius: 10, fontSize: 13, lineHeight: 1.6, color: '#5c4515' }}>
          <strong style={{ display: 'block', marginBottom: 8 }}>⚠ This is a static mockup at /mock-start</strong>
          Nothing on this page is wired. What&apos;s different vs the current form:
          <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
            <li>Two-column layout — resume left, JD right (stacks on mobile)</li>
            <li>Dropzone with clear drop-target, filename preview, browse fallback</li>
            <li>Segmented tabs for JD source (Paste / URL / Upload) with proper active state</li>
            <li>Labels left-aligned, helper text under each field, character-count hints</li>
            <li>URL input paired with the renamed &ldquo;Analyse&rdquo; button (was &ldquo;Scrape&rdquo;)</li>
            <li>Dark action row matching the hero aesthetic, gradient primary button</li>
            <li>Required-field indicator (green dot)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
