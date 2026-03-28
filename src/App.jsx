import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// ─── System Prompts ────────────────────────────────────────────────────────────

const PROMPT_CV = `You are an expert CV/resume writer and ATS (Applicant Tracking System) optimisation specialist.

CRITICAL RULES:
1. NEVER fabricate, invent, or embellish any experience, skill, qualification, or achievement that the candidate did not actually do. The FACTS must remain true.
2. You SHOULD actively reword, rephrase, and upgrade language throughout. Replace weak or generic phrasing with stronger, more impactful, industry-appropriate terminology. For example: "helped with" → "drove", "was responsible for" → "led", "worked on projects" → "delivered cross-functional initiatives". Use the vocabulary and terminology that appears in the job description where the candidate's experience genuinely supports it.
3. Rewrite bullet points to be punchier, more results-oriented, and better aligned to the target role — but the underlying achievement must be real.
4. Identify the most salient points from the CV that match the job description.
5. Reorder sections and bullets to lead with the most relevant experience.
6. Mirror keywords from the job description naturally — no keyword-stuffing.
7. Quantify achievements only where the original CV provides numbers. Do not invent metrics.
8. ATS-friendly format: clear section headings, no tables/columns/graphics.
9. Deprioritise irrelevant experience (move lower, don't delete).
10. Rewrite the Professional Summary to directly address the target role.
11. Keep to 2 pages max.

The line is: change HOW something is described, never WHAT was done.

Respond with ONLY the rewritten CV in clean structured text with ## headings, **bold**, and - bullets.`;

const PROMPT_CHANGES = `You are an expert CV consultant explaining your optimisation decisions.

Given the ORIGINAL CV, the REWRITTEN CV, and the JOB DESCRIPTION, provide a clear summary of every significant change you observe between the original and rewritten versions.

For each change, explain:
- WHAT was changed (be specific — quote brief snippets)
- WHY it was changed (what ATS or hiring manager behaviour does this address)
- HOW it helps (the concrete advantage for this specific application)

Group changes under these categories:
1. **Language & Wording Upgrades** — where weaker phrasing was replaced with stronger, more relevant terminology (show before → after)
2. **Structure & Ordering** — sections or bullets reordered
3. **Keyword Optimisation** — terminology aligned to the job description
4. **Impact & Metrics** — achievements reframed for relevance
5. **Summary/Profile** — how the opening was tailored
6. **Removed or Deprioritised** — what was moved down and why

Be honest. If the original CV was already strong in an area, say so. End with a brief overall ATS compatibility score estimate (Low / Medium / High / Very High) and one sentence on the biggest remaining weakness.

Respond in clean structured text with ## headings and - bullets.`;

const PROMPT_COVER = `You are an expert cover letter writer.

CRITICAL RULES:
1. NEVER fabricate any experience or achievement. Only reference what appears in the CV — but you SHOULD use stronger, more compelling language than the CV itself. Upgrade weak phrasing into confident, persuasive prose.
2. Open with a strong specific hook — never "I am writing to apply for..."
3. Each paragraph maps a candidate strength to a job requirement.
4. Use concrete examples from the CV, not vague claims.
5. Match the tone to the industry and seniority level.
6. Keep to ~300-400 words (one page).
7. Close with confidence and a clear call to action.
8. Complement the CV — don't repeat it verbatim.

Output clean plain text. Use the candidate's name if available.`;

const PROMPT_CROSS = `You are an expert career analyst. You have access to a candidate's BASE CV and multiple tailored versions they've created for different roles.

Analyse the patterns across all versions and provide:

1. **Core Strengths** — What skills/experiences consistently surface as the candidate's strongest assets across all applications?
2. **Versatility Map** — What range of roles has this person targeted? Where do they pivot well vs stretch thin?
3. **Underused Assets** — What's in the base CV that rarely gets highlighted? Could it be leveraged better?
4. **Keyword Gaps** — Are there industry keywords or skills the candidate should consider developing?
5. **Strategic Advice** — Based on the pattern of applications, what type of role appears to be the best fit, and what should the candidate emphasise going forward?

Be direct and actionable. This is career strategy, not cheerleading.`;

// ─── API Helper ────────────────────────────────────────────────────────────────

async function callAPI(system, prompt) {
  const res = await fetch('/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, prompt }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.text;
}

// ─── Persistence ───────────────────────────────────────────────────────────────

function loadBaseCV() {
  try { return localStorage.getItem('ats-base-cv') || ''; } catch { return ''; }
}
function saveBaseCV(text) {
  try { localStorage.setItem('ats-base-cv', text); } catch {}
}
function clearBaseCV() {
  try { localStorage.removeItem('ats-base-cv'); } catch {}
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('ats-history') || '[]'); } catch { return []; }
}
function saveHistory(history) {
  try { localStorage.setItem('ats-history', JSON.stringify(history.slice(0, 50))); } catch {}
}

// ─── File Reader ───────────────────────────────────────────────────────────────

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

async function readFileAsText(file) {
  const name = file.name.toLowerCase();
  const ext = name.substring(name.lastIndexOf('.'));

  if (ext === '.docx') {
    try {
      const arrayBuf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuf });
      if (result.value && result.value.trim().length > 0) return result.value;
      throw new Error('Empty extraction');
    } catch (e) {
      console.error('Mammoth .docx extraction failed:', e);
      throw new Error('Could not extract text from .docx. Please try .txt or .pdf.');
    }
  }

  if (ext === '.pdf') {
    try {
      const arrayBuf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(' '));
      }
      return pages.join('\n\n');
    } catch (e) {
      console.error('PDF extraction failed:', e);
      throw new Error('Could not extract text from PDF. Try a different format.');
    }
  }

  if (ext === '.doc') {
    throw new Error('.doc is not supported in the browser. Please save as .docx, .pdf, or .txt.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ─── Extract Job Title ─────────────────────────────────────────────────────────

function extractJobTitle(jobDesc) {
  const lines = jobDesc.trim().split('\n').filter(l => l.trim());
  for (const line of lines.slice(0, 5)) {
    const clean = line.replace(/^[#*\-\s]+/, '').trim();
    if (clean.length > 3 && clean.length < 100) return clean.slice(0, 80);
  }
  return 'Untitled Role';
}

// ─── Design Tokens ──────────────────────────────────────────────────────────────

const shared = {
  accent: '#e85d75',
  accentDark: '#d14d65',
  accentGlow: 'rgba(232,93,117,0.15)',
  accentSoft: 'rgba(232,93,117,0.08)',
  green: '#34d399',
  red: '#f87171',
  font: "'DM Sans', sans-serif",
  fontHeading: "'Sora', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
  radius: 16,
  radiusSm: 10,
  docBg: '#ffffff',
  docText: '#1a1a2e',
  docTextDim: '#4a5568',
  docBorder: '#e2e8f0',
  docHeading: '#0f172a',
};

const darkTheme = {
  ...shared,
  bg: '#08090e',
  surface: 'rgba(255,255,255,0.04)',
  card: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.08)',
  text: '#f1f5f9',
  textDim: 'rgba(255,255,255,0.45)',
  textMid: 'rgba(255,255,255,0.7)',
  redBg: 'rgba(248,113,113,0.1)',
  headerBg: 'rgba(8,9,14,0.85)',
  inputBg: 'rgba(0,0,0,0.3)',
  orbAccent: 'rgba(232,93,117,0.08)',
  orbSecondary: 'rgba(99,102,241,0.06)',
  orbTertiary: 'rgba(232,93,117,0.04)',
};

const lightTheme = {
  ...shared,
  bg: '#f5f5f7',
  surface: 'rgba(0,0,0,0.02)',
  card: 'rgba(255,255,255,0.85)',
  cardBorder: 'rgba(0,0,0,0.08)',
  border: 'rgba(0,0,0,0.08)',
  text: '#1a1a2e',
  textDim: 'rgba(0,0,0,0.4)',
  textMid: 'rgba(0,0,0,0.65)',
  redBg: 'rgba(248,113,113,0.08)',
  headerBg: 'rgba(245,245,247,0.88)',
  inputBg: 'rgba(0,0,0,0.04)',
  orbAccent: 'rgba(232,93,117,0.06)',
  orbSecondary: 'rgba(99,102,241,0.05)',
  orbTertiary: 'rgba(232,93,117,0.03)',
};

function loadTheme() {
  try { return localStorage.getItem('ats-theme') || 'dark'; } catch { return 'dark'; }
}
function saveTheme(t) {
  try { localStorage.setItem('ats-theme', t); } catch {}
}

// Global ref that components read — updated by App on toggle
let C = darkTheme;

// ─── Ambient Background ─────────────────────────────────────────────────────────

function AmbientOrbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', width: 600, height: 600,
        borderRadius: '50%', top: '-10%', left: '-10%',
        background: `radial-gradient(circle, ${C.orbAccent} 0%, transparent 70%)`,
        animation: 'orbFloat1 25s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 500, height: 500,
        borderRadius: '50%', bottom: '-5%', right: '-10%',
        background: `radial-gradient(circle, ${C.orbSecondary} 0%, transparent 70%)`,
        animation: 'orbFloat2 30s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400,
        borderRadius: '50%', top: '40%', left: '60%',
        background: `radial-gradient(circle, ${C.orbTertiary} 0%, transparent 70%)`,
        animation: 'orbFloat3 20s ease-in-out infinite',
      }} />
    </div>
  );
}

// ─── Theme Toggle Button ────────────────────────────────────────────────────────

function ThemeToggle({ isDark, onToggle }) {
  return (
    <button onClick={onToggle} aria-label="Toggle theme" style={{
      background: 'none', border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
      color: C.textMid, fontSize: 18, lineHeight: 1,
      display: 'flex', alignItems: 'center', gap: 6,
      transition: 'all 0.2s',
    }}>
      {isDark ? '☀️' : '🌙'}
      <span style={{ fontSize: 11, fontFamily: C.font, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {isDark ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}

// ─── Core UI Components ─────────────────────────────────────────────────────────

function Spinner({ size = 18 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid ${C.border}`, borderTopColor: C.accent,
      borderRadius: '50%', animation: 'ats-spin 0.6s linear infinite',
    }} />
  );
}

function Btn({ children, variant = 'primary', disabled, onClick, style }) {
  const [hover, setHover] = useState(false);
  const base = {
    fontFamily: C.font, fontSize: 14, fontWeight: 600,
    padding: '12px 28px', borderRadius: 50, cursor: 'pointer',
    border: 'none', transition: 'all 0.25s ease',
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
    display: 'inline-flex', alignItems: 'center', gap: 8,
    letterSpacing: '0.01em', ...style,
  };
  if (variant === 'primary') {
    Object.assign(base, {
      background: hover ? C.accentDark : C.accent, color: '#fff', fontWeight: 700,
      boxShadow: hover ? '0 4px 24px rgba(232,93,117,0.4)' : '0 2px 16px rgba(232,93,117,0.25)',
      transform: hover ? 'translateY(-1px)' : 'none',
    });
  } else if (variant === 'secondary') {
    Object.assign(base, {
      background: hover ? 'rgba(232,93,117,0.12)' : 'rgba(232,93,117,0.06)',
      color: C.accent, border: `1.5px solid ${hover ? C.accent : 'rgba(232,93,117,0.3)'}`,
    });
  } else {
    Object.assign(base, {
      background: hover ? C.surface : 'transparent',
      color: C.textMid, padding: '8px 14px', fontSize: 13, borderRadius: 8,
    });
  }
  return (
    <button style={base} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    >{children}</button>
  );
}

function GlassCard({ children, style }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.cardBorder}`,
      borderRadius: C.radius, backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', ...style,
    }}>{children}</div>
  );
}

// ─── Markdown Rendering ─────────────────────────────────────────────────────────

const screenMdComponents = {
  h1: ({ children }) => <h1 style={{ fontFamily: C.fontHeading, fontSize: 22, fontWeight: 700, color: C.text, margin: '20px 0 10px', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontFamily: C.fontHeading, fontSize: 18, fontWeight: 700, color: C.text, margin: '18px 0 8px' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontFamily: C.font, fontSize: 15, fontWeight: 700, color: C.text, margin: '14px 0 6px' }}>{children}</h3>,
  p: ({ children }) => <p style={{ fontSize: 14, lineHeight: 1.7, color: C.textMid, margin: '0 0 12px' }}>{children}</p>,
  strong: ({ children }) => <strong style={{ color: C.text, fontWeight: 700 }}>{children}</strong>,
  ul: ({ children }) => <ul style={{ margin: '0 0 12px', paddingLeft: 0, listStyle: 'none' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '0 0 12px', paddingLeft: 20, color: C.textMid }}>{children}</ol>,
  li: ({ children }) => (
    <li style={{ fontSize: 14, lineHeight: 1.7, color: C.textMid, marginBottom: 4, paddingLeft: 18, position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, color: C.accent, fontWeight: 700 }}>›</span>
      {children}
    </li>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '16px 0' }} />,
};

const docMdComponents = {
  h1: ({ children }) => <h1 style={{ fontFamily: C.fontHeading, fontSize: 24, fontWeight: 800, color: C.docHeading, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontFamily: C.fontHeading, fontSize: 13, fontWeight: 700, color: C.docHeading, margin: '22px 0 8px', paddingBottom: 5, borderBottom: `1.5px solid ${C.docBorder}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontFamily: C.font, fontSize: 14, fontWeight: 700, color: C.docHeading, margin: '14px 0 4px' }}>{children}</h3>,
  p: ({ children }) => <p style={{ fontFamily: C.font, fontSize: 13, lineHeight: 1.65, color: C.docText, margin: '0 0 10px' }}>{children}</p>,
  strong: ({ children }) => <strong style={{ color: C.docHeading, fontWeight: 700 }}>{children}</strong>,
  ul: ({ children }) => <ul style={{ margin: '0 0 10px', paddingLeft: 0, listStyle: 'none' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '0 0 10px', paddingLeft: 18, color: C.docText, fontSize: 13 }}>{children}</ol>,
  li: ({ children }) => (
    <li style={{ fontSize: 13, lineHeight: 1.6, color: C.docText, marginBottom: 3, paddingLeft: 14, position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, color: C.accent, fontSize: 8, top: 7 }}>●</span>
      {children}
    </li>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${C.docBorder}`, margin: '14px 0' }} />,
};

function MarkdownContent({ content, variant = 'screen' }) {
  return <ReactMarkdown components={variant === 'document' ? docMdComponents : screenMdComponents}>{content}</ReactMarkdown>;
}

// ─── File Drop Zone ─────────────────────────────────────────────────────────────

function DropZone({ onText, label, onError }) {
  const [over, setOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setFileError('');
    try {
      const text = await readFileAsText(file);
      setFileName(file.name);
      onText(text);
    } catch (e) {
      setFileName('');
      setFileError(e.message);
      if (onError) onError(e.message);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => {
          const inp = document.createElement('input');
          inp.type = 'file'; inp.accept = '.txt,.docx,.rtf,.pdf';
          inp.onchange = () => handleFile(inp.files[0]);
          inp.click();
        }}
        style={{
          border: `2px dashed ${over ? C.accent : C.border}`,
          borderRadius: C.radiusSm, padding: '28px 16px',
          textAlign: 'center', cursor: 'pointer',
          background: over ? C.accentSoft : C.surface,
          transition: 'all 0.25s', marginBottom: 10,
          color: C.textDim, fontSize: 14,
        }}
      >
        {fileName
          ? <span style={{ color: C.accent, fontWeight: 600 }}>{fileName}</span>
          : (label || 'Drop a file or click to upload (.txt, .docx, .rtf, .pdf)')
        }
      </div>
      {fileError && (
        <div style={{ fontSize: 12, color: C.red, marginBottom: 8, padding: '8px 12px', background: C.redBg, borderRadius: 8 }}>
          {fileError}
        </div>
      )}
    </div>
  );
}

// ─── Step Indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ steps, activeStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 36, padding: '0 20px' }}>
      {steps.map((step, i) => {
        const done = i < activeStep;
        const active = i === activeStep;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, fontFamily: C.font,
                background: done ? C.accent : active ? C.accentSoft : C.surface,
                color: done ? '#fff' : active ? C.accent : C.textDim,
                border: active ? `2px solid ${C.accent}` : done ? 'none' : `1px solid ${C.border}`,
                transition: 'all 0.3s',
                boxShadow: done ? '0 2px 12px rgba(232,93,117,0.3)' : 'none',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: active ? C.accent : done ? C.textMid : C.textDim,
                textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
              }}>{step}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 60, height: 2, margin: '0 12px', marginBottom: 22,
                background: done ? C.accent : C.border,
                borderRadius: 1, transition: 'all 0.3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Document Preview (A4-style panel) ──────────────────────────────────────────

function DocumentPreview({ title, emoji, content, loading }) {
  const contentRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  if (!content && !loading) return null;

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPDF = async () => {
    if (!contentRef.current || generating) return;
    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const el = contentRef.current;
      // Temporarily remove scroll constraints for full capture
      const origMax = el.style.maxHeight;
      const origOverflow = el.style.overflowY;
      el.style.maxHeight = 'none';
      el.style.overflowY = 'visible';
      await html2pdf().set({
        margin: [12, 12, 12, 12],
        filename: `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(el).save();
      el.style.maxHeight = origMax;
      el.style.overflowY = origOverflow;
    } catch (e) {
      console.error('PDF generation failed:', e);
    }
    setGenerating(false);
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Toolbar */}
      <GlassCard style={{
        padding: '12px 20px', borderRadius: '12px 12px 0 0',
        borderBottom: 'none',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <h3 style={{
          fontFamily: C.font, fontSize: 13, color: C.textMid, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8,
          letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0,
        }}>
          <span style={{ fontSize: 18 }}>{emoji}</span>
          {title}
        </h3>
        {content && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="ghost" onClick={copy} style={{ fontSize: 12 }}>
              {copied ? '✓ Copied' : 'Copy'}
            </Btn>
            <Btn variant="secondary" onClick={downloadPDF} disabled={generating}
              style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8 }}>
              {generating ? <Spinner size={12} /> : null}
              Download PDF
            </Btn>
          </div>
        )}
      </GlassCard>

      {/* Document Panel */}
      {loading && !content ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.cardBorder}`,
          borderRadius: '0 0 12px 12px', textAlign: 'center', padding: 60,
        }}>
          <Spinner size={28} />
          <p style={{ fontSize: 13, color: C.textDim, marginTop: 14 }}>Generating your {title.toLowerCase()}...</p>
        </div>
      ) : (
        <div style={{
          background: C.docBg, borderRadius: '0 0 12px 12px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
          position: 'relative',
        }}>
          {/* Subtle page edge effect */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, ${C.accent}, #6366f1, ${C.accent})`,
            borderRadius: '0 0 0 0', opacity: 0.7,
          }} />
          <div
            ref={contentRef}
            style={{
              padding: '40px 44px', maxHeight: 700, overflowY: 'auto',
              fontFamily: C.font,
            }}
          >
            <MarkdownContent content={content} variant="document" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Analysis Result Block (glass card, screen variant) ─────────────────────────

function ResultBlock({ title, emoji, content, loading }) {
  if (!content && !loading) return null;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <GlassCard style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px',
        borderBottom: content ? `1px solid ${C.border}` : 'none',
      }}>
        <h3 style={{
          fontFamily: C.font, fontSize: 13, color: C.textMid, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8, margin: 0,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          <span style={{ fontSize: 18 }}>{emoji}</span>
          {title}
        </h3>
        {content && (
          <Btn variant="ghost" onClick={copy} style={{ fontSize: 12 }}>
            {copied ? '✓ Copied' : 'Copy'}
          </Btn>
        )}
      </div>
      {loading && !content ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spinner size={24} />
          <p style={{ fontSize: 13, color: C.textDim, marginTop: 12 }}>Analysing...</p>
        </div>
      ) : (
        <div style={{ padding: 20, maxHeight: 500, overflowY: 'auto' }}>
          <MarkdownContent content={content} variant="screen" />
        </div>
      )}
    </GlassCard>
  );
}

// ─── History Card ───────────────────────────────────────────────────────────────

function HistoryCard({ item, onView, onDelete }) {
  const [hover, setHover] = useState(false);
  const date = new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const badges = [item.hasCV && 'CV', item.hasCover && 'Cover', item.hasChanges && 'Analysis'].filter(Boolean);

  return (
    <GlassCard style={{
      padding: 18, marginBottom: 12,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 10,
      borderColor: hover ? C.border : C.cardBorder,
      transition: 'all 0.2s',
    }}>
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: C.text }}>{item.jobTitle}</div>
        <div style={{ fontSize: 12, color: C.textDim, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{date}</span>
          {badges.map(b => (
            <span key={b} style={{
              background: C.accentSoft, color: C.accent,
              padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>{b}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="secondary" onClick={onView} style={{ padding: '8px 16px', fontSize: 13 }}>View</Btn>
        <Btn variant="ghost" onClick={onDelete} style={{ color: C.red, fontSize: 13 }}>Delete</Btn>
      </div>
    </GlassCard>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [theme, setTheme] = useState(loadTheme);
  const isDark = theme === 'dark';
  C = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    saveTheme(next);
  };

  // Apply body bg
  useEffect(() => {
    document.body.style.background = C.bg;
    document.body.style.color = C.text;
  }, [theme]);

  const [tab, setTab] = useState('input');
  const [cvText, setCvText] = useState('');
  const [jobText, setJobText] = useState('');
  const [savedCV, setSavedCV] = useState('');
  const [error, setError] = useState('');

  const [rewrittenCV, setRewrittenCV] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [loadingCV, setLoadingCV] = useState(false);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [loadingCover, setLoadingCover] = useState(false);

  const [history, setHistory] = useState([]);
  const [viewingItem, setViewingItem] = useState(null);
  const [crossAnalysis, setCrossAnalysis] = useState('');
  const [loadingCross, setLoadingCross] = useState(false);

  const isLoading = loadingCV || loadingChanges || loadingCover;

  useEffect(() => {
    const saved = loadBaseCV();
    if (saved) { setSavedCV(saved); setCvText(saved); }
    setHistory(loadHistory());
  }, []);

  const addToHistory = useCallback((entry) => {
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, 50);
      saveHistory(next);
      return next;
    });
  }, []);

  const updateHistoryItem = useCallback((id, updates) => {
    setHistory(prev => {
      const next = prev.map(h => h.id === id ? { ...h, ...updates } : h);
      saveHistory(next);
      return next;
    });
  }, []);

  // ── Determine active step ──
  const activeStep = !cvText.trim() ? 0 : !jobText.trim() ? 1 : 2;

  // ── Action Handlers ──────────────────────────────────────────────────────────

  const runFullPackage = async () => {
    if (!cvText.trim() || !jobText.trim()) { setError('Please provide both your CV and a job description.'); return; }
    setError(''); setRewrittenCV(''); setChangeSummary(''); setCoverLetter('');
    setViewingItem(null); setTab('results');
    setLoadingCV(true); setLoadingCover(true);
    const jobTitle = extractJobTitle(jobText);
    const historyId = Date.now().toString();
    try {
      const cvPrompt = `Here is my CV:\n\n${cvText}\n\nHere is the job description:\n\n${jobText}`;
      const coverPrompt = `Here is my CV:\n\n${cvText}\n\nHere is the job description:\n\n${jobText}\n\nWrite a cover letter.`;
      const [cvResult, coverResult] = await Promise.all([
        callAPI(PROMPT_CV, cvPrompt), callAPI(PROMPT_COVER, coverPrompt),
      ]);
      setRewrittenCV(cvResult); setLoadingCV(false);
      setCoverLetter(coverResult); setLoadingCover(false);
      setLoadingChanges(true);
      const changesResult = await callAPI(PROMPT_CHANGES, `ORIGINAL CV:\n${cvText}\n\nREWRITTEN CV:\n${cvResult}\n\nJOB DESCRIPTION:\n${jobText}`);
      setChangeSummary(changesResult); setLoadingChanges(false);
      addToHistory({ id: historyId, date: new Date().toISOString(), jobTitle, jobDesc: jobText.slice(0, 500), rewrittenCV: cvResult, coverLetter: coverResult, changeSummary: changesResult, hasCV: true, hasCover: true, hasChanges: true });
    } catch (err) { setError(err.message); setLoadingCV(false); setLoadingChanges(false); setLoadingCover(false); }
  };

  const runCVOnly = async () => {
    if (!cvText.trim() || !jobText.trim()) { setError('Please provide both your CV and a job description.'); return; }
    setError(''); setRewrittenCV(''); setChangeSummary(''); setCoverLetter('');
    setViewingItem(null); setTab('results'); setLoadingCV(true);
    const jobTitle = extractJobTitle(jobText);
    const historyId = Date.now().toString();
    try {
      const cvResult = await callAPI(PROMPT_CV, `Here is my CV:\n\n${cvText}\n\nHere is the job description:\n\n${jobText}`);
      setRewrittenCV(cvResult); setLoadingCV(false);
      setLoadingChanges(true);
      const changesResult = await callAPI(PROMPT_CHANGES, `ORIGINAL CV:\n${cvText}\n\nREWRITTEN CV:\n${cvResult}\n\nJOB DESCRIPTION:\n${jobText}`);
      setChangeSummary(changesResult); setLoadingChanges(false);
      addToHistory({ id: historyId, date: new Date().toISOString(), jobTitle, jobDesc: jobText.slice(0, 500), rewrittenCV: cvResult, coverLetter: '', changeSummary: changesResult, hasCV: true, hasCover: false, hasChanges: true });
    } catch (err) { setError(err.message); setLoadingCV(false); setLoadingChanges(false); }
  };

  const runCoverOnly = async () => {
    if (!cvText.trim() || !jobText.trim()) { setError('Please provide both your CV and a job description.'); return; }
    setError(''); setCoverLetter(''); setViewingItem(null); setTab('results'); setLoadingCover(true);
    try {
      const coverResult = await callAPI(PROMPT_COVER, `Here is my CV:\n\n${cvText}\n\nHere is the job description:\n\n${jobText}\n\nWrite a cover letter.`);
      setCoverLetter(coverResult); setLoadingCover(false);
      const recent = history[0];
      if (recent && !recent.hasCover) { updateHistoryItem(recent.id, { coverLetter: coverResult, hasCover: true }); }
      else { addToHistory({ id: Date.now().toString(), date: new Date().toISOString(), jobTitle: extractJobTitle(jobText), jobDesc: jobText.slice(0, 500), rewrittenCV: '', coverLetter: coverResult, changeSummary: '', hasCV: false, hasCover: true, hasChanges: false }); }
    } catch (err) { setError(err.message); setLoadingCover(false); }
  };

  const runCrossAnalysis = async () => {
    setCrossAnalysis(''); setLoadingCross(true);
    try {
      const items = history.slice(0, 10);
      const prompt = `BASE CV:\n${savedCV || cvText}\n\n` + items.map((h, i) =>
        `--- APPLICATION ${i + 1}: ${h.jobTitle} ---\nJob Description:\n${h.jobDesc}\n\nTailored CV:\n${h.rewrittenCV || '(not generated)'}`
      ).join('\n\n');
      const result = await callAPI(PROMPT_CROSS, prompt);
      setCrossAnalysis(result);
    } catch (err) { setError(err.message); }
    setLoadingCross(false);
  };

  const viewHistoryItem = (item) => {
    setViewingItem(item); setRewrittenCV(item.rewrittenCV || '');
    setChangeSummary(item.changeSummary || ''); setCoverLetter(item.coverLetter || '');
    setTab('results');
  };
  const deleteHistoryItem = (id) => { setHistory(prev => { const next = prev.filter(h => h.id !== id); saveHistory(next); return next; }); };
  const handleSaveCV = () => { saveBaseCV(cvText); setSavedCV(cvText); };
  const handleClearCV = () => { clearBaseCV(); setSavedCV(''); };

  const hasResults = rewrittenCV || changeSummary || coverLetter;

  const textareaStyle = {
    width: '100%', fontFamily: C.fontMono, fontSize: 13,
    background: C.inputBg, color: C.textMid,
    border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
    padding: 16, resize: 'vertical', lineHeight: 1.7, outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const tabs = [
    { id: 'input', label: 'Input', num: '01' },
    { id: 'results', label: 'Results', num: '02' },
    { id: 'library', label: 'Library', num: '03' },
  ];

  return (
    <>
      <style>{`
        @keyframes ats-spin { to { transform: rotate(360deg); } }
        @keyframes orbFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,40px) scale(1.1)} 66%{transform:translate(-30px,70px) scale(.95)} }
        @keyframes orbFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,-30px) scale(1.05)} 66%{transform:translate(40px,-60px) scale(.9)} }
        @keyframes orbFloat3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-70px,30px) scale(1.15)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        textarea:focus { border-color: ${C.accent} !important; box-shadow: 0 0 0 3px ${C.accentGlow} !important; }
      `}</style>

      <AmbientOrbs />

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: C.headerBg,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`, padding: '18px 24px',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontFamily: C.fontHeading, fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: '-0.02em', marginBottom: 4 }}>
                ATS<span style={{ color: C.accent }}>.</span>rewrite
              </h1>
              <p style={{ fontSize: 13, color: C.textDim, marginBottom: 18, letterSpacing: '0.02em' }}>
                Tailored CVs & cover letters that get past the bots — and impress the humans.
              </p>
            </div>
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
          </div>
          <nav style={{ display: 'flex', gap: 4 }}>
            {tabs.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  fontFamily: C.font, fontSize: 13, fontWeight: 600,
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  cursor: 'pointer', transition: 'all 0.2s',
                  background: active ? C.accentSoft : 'transparent',
                  color: active ? C.accent : C.textDim,
                  letterSpacing: '0.04em', textTransform: 'uppercase', position: 'relative',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, marginRight: 6, opacity: 0.5 }}>{t.num}</span>
                  {t.label}
                  {t.id === 'results' && hasResults && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, position: 'absolute', top: 7, right: 7, boxShadow: `0 0 8px ${C.green}` }} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '28px 24px 80px', position: 'relative', zIndex: 1, animation: 'fadeUp 0.4s ease' }}>

        {error && (
          <GlassCard style={{ padding: '14px 18px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: C.red, borderColor: 'rgba(248,113,113,0.2)', background: C.redBg }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>&times;</button>
          </GlassCard>
        )}

        {/* ── INPUT TAB ─────────────────────────────────────────────────── */}
        {tab === 'input' && (
          <>
            <StepIndicator steps={['Your CV', 'Job Description', 'Generate']} activeStep={activeStep} />

            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: cvText.trim() ? C.accent : C.accentSoft, color: cvText.trim() ? '#fff' : C.accent,
                  fontSize: 12, fontWeight: 700, transition: 'all 0.3s',
                }}>1</div>
                <h2 style={{ fontFamily: C.fontHeading, fontSize: 22, fontWeight: 700, color: C.text }}>Your CV</h2>
              </div>
              <GlassCard style={{ padding: 20 }}>
                <DropZone onText={setCvText} onError={setError} />
                <textarea value={cvText} onChange={e => setCvText(e.target.value)} placeholder="Or paste your CV here..." rows={10} style={textareaStyle} />
                <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {savedCV ? (
                    <>
                      <span style={{ color: C.green, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, display: 'inline-block', boxShadow: `0 0 6px ${C.green}` }} />
                        Saved
                      </span>
                      <Btn variant="ghost" onClick={handleClearCV}>Clear saved</Btn>
                    </>
                  ) : cvText.trim() ? (
                    <Btn variant="secondary" onClick={handleSaveCV} style={{ fontSize: 13 }}>Save for next time</Btn>
                  ) : null}
                </div>
                {savedCV && <p style={{ fontSize: 12, color: C.textDim, marginTop: 10 }}>Your CV is saved in this browser. Just paste a new job description and go.</p>}
              </GlassCard>
            </section>

            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: jobText.trim() ? C.accent : C.accentSoft, color: jobText.trim() ? '#fff' : C.accent,
                  fontSize: 12, fontWeight: 700, transition: 'all 0.3s',
                }}>2</div>
                <h2 style={{ fontFamily: C.fontHeading, fontSize: 22, fontWeight: 700, color: C.text }}>Job Description</h2>
              </div>
              <GlassCard style={{ padding: 20 }}>
                <DropZone onText={setJobText} onError={setError} label="Drop a job description file or click to upload" />
                <textarea value={jobText} onChange={e => setJobText(e.target.value)} placeholder="Paste the job description here..." rows={8} style={textareaStyle} />
              </GlassCard>
            </section>

            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: activeStep === 2 ? C.accent : C.accentSoft, color: activeStep === 2 ? '#fff' : C.accent,
                  fontSize: 12, fontWeight: 700, transition: 'all 0.3s',
                }}>3</div>
                <h2 style={{ fontFamily: C.fontHeading, fontSize: 22, fontWeight: 700, color: C.text }}>Generate</h2>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Btn variant="primary" disabled={isLoading || activeStep < 2} onClick={runFullPackage}
                  style={{ padding: '14px 36px', fontSize: 15 }}>
                  {isLoading ? <Spinner size={16} /> : <span>⚡</span>}
                  Full Package
                </Btn>
                <Btn variant="secondary" disabled={isLoading || activeStep < 2} onClick={runCVOnly}>CV + Analysis</Btn>
                <Btn variant="secondary" disabled={isLoading || activeStep < 2} onClick={runCoverOnly}>Cover Letter</Btn>
              </div>
              {activeStep < 2 && (
                <p style={{ textAlign: 'center', fontSize: 12, color: C.textDim, marginTop: 12 }}>
                  Complete steps 1 & 2 above to unlock generation.
                </p>
              )}
            </section>
          </>
        )}

        {/* ── RESULTS TAB ───────────────────────────────────────────────── */}
        {tab === 'results' && (
          <>
            {viewingItem && (
              <GlassCard style={{ padding: '12px 18px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderColor: 'rgba(232,93,117,0.2)', background: C.accentSoft }}>
                <span>
                  <strong style={{ color: C.accent }}>{viewingItem.jobTitle}</strong>
                  <span style={{ color: C.textDim, marginLeft: 10 }}>
                    {new Date(viewingItem.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </span>
                <Btn variant="ghost" onClick={() => { setViewingItem(null); setRewrittenCV(''); setChangeSummary(''); setCoverLetter(''); }}>Close</Btn>
              </GlassCard>
            )}

            {!hasResults && !isLoading ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📋</div>
                <p style={{ fontSize: 16, color: C.textDim, marginBottom: 8 }}>No results yet</p>
                <p style={{ fontSize: 13, color: C.textDim, opacity: 0.6 }}>
                  Head to <strong style={{ color: C.textMid }}>Input</strong> and submit your CV + job description.
                </p>
              </div>
            ) : (
              <>
                <DocumentPreview title="Rewritten CV" emoji="📄" content={rewrittenCV} loading={loadingCV} />
                <DocumentPreview title="Cover Letter" emoji="✉️" content={coverLetter} loading={loadingCover} />
                <ResultBlock title="What Changed & Why" emoji="🔍" content={changeSummary} loading={loadingChanges} />
              </>
            )}
          </>
        )}

        {/* ── LIBRARY TAB ───────────────────────────────────────────────── */}
        {tab === 'library' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>📚</span>
                <h2 style={{ fontFamily: C.fontHeading, fontSize: 22, fontWeight: 700, color: C.text }}>
                  Library
                  <span style={{ fontSize: 13, color: C.textDim, fontFamily: C.font, fontWeight: 400, marginLeft: 10 }}>
                    {history.length} application{history.length !== 1 ? 's' : ''}
                  </span>
                </h2>
              </div>
              {history.length >= 2 && (
                <Btn variant="secondary" disabled={loadingCross} onClick={runCrossAnalysis}>
                  {loadingCross ? <Spinner size={14} /> : <span>🔍</span>}
                  Cross Analysis
                </Btn>
              )}
            </div>
            <ResultBlock title="Cross-Application Analysis" emoji="📊" content={crossAnalysis} loading={loadingCross} />
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📚</div>
                <p style={{ fontSize: 14, color: C.textDim }}>Your tailored CVs will appear here. Each application is saved automatically.</p>
              </div>
            ) : history.map(item => (
              <HistoryCard key={item.id} item={item} onView={() => viewHistoryItem(item)} onDelete={() => deleteHistoryItem(item.id)} />
            ))}
          </>
        )}
      </main>
    </>
  );
}
