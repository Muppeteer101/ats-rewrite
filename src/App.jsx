import { useState, useEffect, useRef, useCallback } from 'react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

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
      if (result.value && result.value.trim().length > 0) {
        return result.value;
      }
      throw new Error('Empty extraction');
    } catch (e) {
      console.error('Mammoth .docx extraction failed:', e);
      throw new Error('Could not extract text from .docx file. Please try saving as .txt or .pdf and re-uploading.');
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
      throw new Error('Could not extract text from PDF. Please try a different format.');
    }
  }

  if (ext === '.doc') {
    throw new Error('.doc format is not supported in the browser. Please save as .docx, .pdf, or .txt and re-upload.');
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

const C = {
  bg: '#08090e',
  surface: 'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.07)',
  surfaceSolid: '#12141c',
  card: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.08)',
  borderFocus: '#e85d75',
  text: '#f1f5f9',
  textDim: 'rgba(255,255,255,0.45)',
  textMid: 'rgba(255,255,255,0.7)',
  accent: '#e85d75',
  accentDark: '#d14d65',
  accentGlow: 'rgba(232,93,117,0.15)',
  accentSoft: 'rgba(232,93,117,0.08)',
  green: '#34d399',
  greenGlow: 'rgba(52,211,153,0.15)',
  red: '#f87171',
  redBg: 'rgba(248,113,113,0.1)',
  font: "'Inter', sans-serif",
  fontHeading: "'Playfair Display', serif",
  fontMono: "'JetBrains Mono', monospace",
  radius: 16,
  radiusSm: 10,
};

// ─── Ambient Background ─────────────────────────────────────────────────────────

function AmbientOrbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', width: 600, height: 600,
        borderRadius: '50%', top: '-10%', left: '-10%',
        background: 'radial-gradient(circle, rgba(232,93,117,0.08) 0%, transparent 70%)',
        animation: 'orbFloat1 25s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 500, height: 500,
        borderRadius: '50%', bottom: '-5%', right: '-10%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
        animation: 'orbFloat2 30s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400,
        borderRadius: '50%', top: '40%', left: '60%',
        background: 'radial-gradient(circle, rgba(232,93,117,0.04) 0%, transparent 70%)',
        animation: 'orbFloat3 20s ease-in-out infinite',
      }} />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ size = 18 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid rgba(255,255,255,0.1)`, borderTopColor: C.accent,
      borderRadius: '50%',
      animation: 'ats-spin 0.6s linear infinite',
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
    letterSpacing: '0.01em',
    ...style,
  };
  if (variant === 'primary') {
    Object.assign(base, {
      background: hover ? C.accentDark : C.accent,
      color: '#ffffff', fontWeight: 700,
      boxShadow: hover
        ? '0 4px 24px rgba(232,93,117,0.4)'
        : '0 2px 16px rgba(232,93,117,0.25)',
      transform: hover ? 'translateY(-1px)' : 'none',
    });
  } else if (variant === 'secondary') {
    Object.assign(base, {
      background: hover ? 'rgba(232,93,117,0.12)' : 'rgba(232,93,117,0.06)',
      color: C.accent,
      border: `1.5px solid ${hover ? C.accent : 'rgba(232,93,117,0.3)'}`,
    });
  } else {
    Object.assign(base, {
      background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
      color: C.textMid,
      padding: '8px 14px', fontSize: 13, borderRadius: 8,
    });
  }
  return (
    <button
      style={base} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    >{children}</button>
  );
}

function GlassCard({ children, style, glow }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: C.radius,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: glow
        ? `0 0 40px ${C.accentGlow}, 0 4px 20px rgba(0,0,0,0.2)`
        : '0 4px 20px rgba(0,0,0,0.15)',
      ...style,
    }}>
      {children}
    </div>
  );
}

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
          inp.type = 'file';
          inp.accept = '.txt,.docx,.rtf,.pdf';
          inp.onchange = () => handleFile(inp.files[0]);
          inp.click();
        }}
        style={{
          border: `2px dashed ${over ? C.accent : 'rgba(255,255,255,0.1)'}`,
          borderRadius: C.radiusSm, padding: '28px 16px',
          textAlign: 'center', cursor: 'pointer',
          background: over ? C.accentSoft : 'rgba(255,255,255,0.02)',
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
        <div style={{
          fontSize: 12, color: C.red, marginBottom: 8,
          padding: '8px 12px', background: C.redBg, borderRadius: 8,
        }}>
          {fileError}
        </div>
      )}
    </div>
  );
}

function ResultBlock({ title, emoji, content, loading }) {
  if (!content && !loading) return null;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const download = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <GlassCard style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px',
        borderBottom: content ? `1px solid ${C.border}` : 'none',
      }}>
        <h3 style={{
          fontFamily: C.font, fontSize: 15, color: C.text, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8,
          letterSpacing: '0.02em', textTransform: 'uppercase',
        }}>
          <span style={{ fontSize: 18 }}>{emoji}</span>
          {title}
        </h3>
        {content && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="ghost" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Btn>
            <Btn variant="ghost" onClick={download}>Download</Btn>
          </div>
        )}
      </div>
      {loading && !content ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spinner size={24} />
          <p style={{ fontSize: 13, color: C.textDim, marginTop: 12 }}>Generating...</p>
        </div>
      ) : (
        <pre style={{
          fontFamily: C.fontMono, fontSize: 13, lineHeight: 1.75,
          color: C.textMid, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 500, overflowY: 'auto', margin: 0,
          padding: 20, background: 'rgba(0,0,0,0.2)',
        }}>{content}</pre>
      )}
    </GlassCard>
  );
}

function HistoryCard({ item, onView, onDelete }) {
  const [hover, setHover] = useState(false);
  const date = new Date(item.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const badges = [
    item.hasCV && 'CV',
    item.hasCover && 'Cover',
    item.hasChanges && 'Analysis',
  ].filter(Boolean);

  return (
    <GlassCard style={{
      padding: 18, marginBottom: 12,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 10,
      borderColor: hover ? 'rgba(255,255,255,0.12)' : C.cardBorder,
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

  // ── Action Handlers ──────────────────────────────────────────────────────────

  const runFullPackage = async () => {
    if (!cvText.trim() || !jobText.trim()) {
      setError('Please provide both your CV and a job description.');
      return;
    }
    setError('');
    setRewrittenCV(''); setChangeSummary(''); setCoverLetter('');
    setViewingItem(null);
    setTab('results');
    setLoadingCV(true); setLoadingCover(true);

    const jobTitle = extractJobTitle(jobText);
    const historyId = Date.now().toString();

    try {
      const cvPrompt = `Here is my CV:\n\n${cvText}\n\nHere is the job description:\n\n${jobText}`;
      const coverPrompt = `Here is my CV:\n\n${cvText}\n\nHere is the job description:\n\n${jobText}\n\nWrite a cover letter.`;

      const [cvResult, coverResult] = await Promise.all([
        callAPI(PROMPT_CV, cvPrompt),
        callAPI(PROMPT_COVER, coverPrompt),
      ]);

      setRewrittenCV(cvResult);
      setLoadingCV(false);
      setCoverLetter(coverResult);
      setLoadingCover(false);

      setLoadingChanges(true);
      const changesPrompt = `ORIGINAL CV:\n${cvText}\n\nREWRITTEN CV:\n${cvResult}\n\nJOB DESCRIPTION:\n${jobText}`;
      const changesResult = await callAPI(PROMPT_CHANGES, changesPrompt);
      setChangeSummary(changesResult);
      setLoadingChanges(false);

      addToHistory({
        id: historyId, date: new Date().toISOString(), jobTitle,
        jobDesc: jobText.slice(0, 500),
        rewrittenCV: cvResult, coverLetter: coverResult, changeSummary: changesResult,
        hasCV: true, hasCover: true, hasChanges: true,
      });
    } catch (err) {
      setError(err.message);
      setLoadingCV(false); setLoadingChanges(false); setLoadingCover(false);
    }
  };

  const runCVOnly = async () => {
    if (!cvText.trim() || !jobText.trim()) {
      setError('Please provide both your CV and a job description.');
      return;
    }
    setError('');
    setRewrittenCV(''); setChangeSummary(''); setCoverLetter('');
    setViewingItem(null);
    setTab('results');
    setLoadingCV(true);

    const jobTitle = extractJobTitle(jobText);
    const historyId = Date.now().toString();

    try {
      const cvPrompt = `Here is my CV:\n\n${cvText}\n\nHere is the job description:\n\n${jobText}`;
      const cvResult = await callAPI(PROMPT_CV, cvPrompt);
      setRewrittenCV(cvResult);
      setLoadingCV(false);

      setLoadingChanges(true);
      const changesPrompt = `ORIGINAL CV:\n${cvText}\n\nREWRITTEN CV:\n${cvResult}\n\nJOB DESCRIPTION:\n${jobText}`;
      const changesResult = await callAPI(PROMPT_CHANGES, changesPrompt);
      setChangeSummary(changesResult);
      setLoadingChanges(false);

      addToHistory({
        id: historyId, date: new Date().toISOString(), jobTitle,
        jobDesc: jobText.slice(0, 500),
        rewrittenCV: cvResult, coverLetter: '', changeSummary: changesResult,
        hasCV: true, hasCover: false, hasChanges: true,
      });
    } catch (err) {
      setError(err.message);
      setLoadingCV(false); setLoadingChanges(false);
    }
  };

  const runCoverOnly = async () => {
    if (!cvText.trim() || !jobText.trim()) {
      setError('Please provide both your CV and a job description.');
      return;
    }
    setError('');
    setCoverLetter('');
    setViewingItem(null);
    setTab('results');
    setLoadingCover(true);

    try {
      const coverPrompt = `Here is my CV:\n\n${cvText}\n\nHere is the job description:\n\n${jobText}\n\nWrite a cover letter.`;
      const coverResult = await callAPI(PROMPT_COVER, coverPrompt);
      setCoverLetter(coverResult);
      setLoadingCover(false);

      const recent = history[0];
      if (recent && !recent.hasCover) {
        updateHistoryItem(recent.id, { coverLetter: coverResult, hasCover: true });
      } else {
        addToHistory({
          id: Date.now().toString(), date: new Date().toISOString(),
          jobTitle: extractJobTitle(jobText),
          jobDesc: jobText.slice(0, 500),
          rewrittenCV: '', coverLetter: coverResult, changeSummary: '',
          hasCV: false, hasCover: true, hasChanges: false,
        });
      }
    } catch (err) {
      setError(err.message);
      setLoadingCover(false);
    }
  };

  const runCrossAnalysis = async () => {
    setCrossAnalysis('');
    setLoadingCross(true);
    try {
      const items = history.slice(0, 10);
      const prompt = `BASE CV:\n${savedCV || cvText}\n\n` +
        items.map((h, i) =>
          `--- APPLICATION ${i + 1}: ${h.jobTitle} ---\nJob Description:\n${h.jobDesc}\n\nTailored CV:\n${h.rewrittenCV || '(not generated)'}`
        ).join('\n\n');
      const result = await callAPI(PROMPT_CROSS, prompt);
      setCrossAnalysis(result);
    } catch (err) {
      setError(err.message);
    }
    setLoadingCross(false);
  };

  const viewHistoryItem = (item) => {
    setViewingItem(item);
    setRewrittenCV(item.rewrittenCV || '');
    setChangeSummary(item.changeSummary || '');
    setCoverLetter(item.coverLetter || '');
    setTab('results');
  };

  const deleteHistoryItem = (id) => {
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      saveHistory(next);
      return next;
    });
  };

  const handleSaveCV = () => { saveBaseCV(cvText); setSavedCV(cvText); };
  const handleClearCV = () => { clearBaseCV(); setSavedCV(''); };

  // ── Render ───────────────────────────────────────────────────────────────────

  const hasResults = rewrittenCV || changeSummary || coverLetter;
  const tabs = [
    { id: 'input', label: 'Input', icon: '01' },
    { id: 'results', label: 'Results', icon: '02' },
    { id: 'library', label: 'Library', icon: '03' },
  ];

  const textareaStyle = {
    width: '100%', fontFamily: C.fontMono, fontSize: 13,
    background: 'rgba(0,0,0,0.3)', color: C.textMid,
    border: `1px solid ${C.border}`,
    borderRadius: C.radiusSm, padding: 16, resize: 'vertical',
    lineHeight: 1.7, outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <>
      <style>{`
        @keyframes ats-spin { to { transform: rotate(360deg); } }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, 40px) scale(1.1); }
          66% { transform: translate(-30px, 70px) scale(0.95); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-50px, -30px) scale(1.05); }
          66% { transform: translate(40px, -60px) scale(0.9); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-70px, 30px) scale(1.15); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        textarea:focus {
          border-color: ${C.accent} !important;
          box-shadow: 0 0 0 3px ${C.accentGlow} !important;
        }
      `}</style>

      <AmbientOrbs />

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(8,9,14,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '18px 24px',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
            <h1 style={{
              fontFamily: C.fontHeading, fontSize: 30, fontWeight: 800,
              color: C.text, letterSpacing: '-0.01em',
            }}>
              ATS<span style={{ color: C.accent }}>.</span>rewrite
            </h1>
          </div>
          <p style={{
            fontSize: 13, color: C.textDim, marginBottom: 18,
            letterSpacing: '0.02em',
          }}>
            Tailored CVs & cover letters that get past the bots — and impress the humans.
          </p>
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
                  position: 'relative',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, marginRight: 6,
                    opacity: 0.5,
                  }}>{t.icon}</span>
                  {t.label}
                  {t.id === 'results' && hasResults && (
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', background: C.green,
                      position: 'absolute', top: 7, right: 7,
                      boxShadow: `0 0 8px ${C.green}`,
                    }} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Body */}
      <main style={{
        maxWidth: 820, margin: '0 auto', padding: '28px 24px 80px',
        position: 'relative', zIndex: 1,
        animation: 'fadeUp 0.4s ease',
      }}>

        {/* Error Banner */}
        {error && (
          <GlassCard style={{
            padding: '14px 18px', marginBottom: 18,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 14, color: C.red,
            borderColor: 'rgba(248,113,113,0.2)',
            background: C.redBg,
          }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{
              background: 'none', border: 'none', color: C.red,
              cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px',
            }}>&times;</button>
          </GlassCard>
        )}

        {/* ── Input Tab ─────────────────────────────────────────────────── */}
        {tab === 'input' && (
          <>
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>&#128196;</span>
                <h2 style={{
                  fontFamily: C.fontHeading, fontSize: 22, fontWeight: 700,
                  color: C.text,
                }}>Your CV</h2>
              </div>
              <GlassCard style={{ padding: 20 }}>
                <DropZone onText={setCvText} onError={setError} />
                <textarea
                  value={cvText}
                  onChange={e => setCvText(e.target.value)}
                  placeholder="Or paste your CV here..."
                  rows={10}
                  style={textareaStyle}
                />
                <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {savedCV ? (
                    <>
                      <span style={{
                        color: C.green, fontSize: 13, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', background: C.green,
                          display: 'inline-block', boxShadow: `0 0 6px ${C.green}`,
                        }} />
                        Saved
                      </span>
                      <Btn variant="ghost" onClick={handleClearCV}>Clear saved</Btn>
                    </>
                  ) : cvText.trim() ? (
                    <Btn variant="secondary" onClick={handleSaveCV} style={{ fontSize: 13 }}>
                      Save for next time
                    </Btn>
                  ) : null}
                </div>
                {savedCV && (
                  <p style={{ fontSize: 12, color: C.textDim, marginTop: 10 }}>
                    Your CV is saved in this browser. Just paste a new job description and go.
                  </p>
                )}
              </GlassCard>
            </section>

            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>&#127919;</span>
                <h2 style={{
                  fontFamily: C.fontHeading, fontSize: 22, fontWeight: 700,
                  color: C.text,
                }}>Job Description</h2>
              </div>
              <GlassCard style={{ padding: 20 }}>
                <DropZone onText={setJobText} onError={setError} label="Drop a job description file or click to upload" />
                <textarea
                  value={jobText}
                  onChange={e => setJobText(e.target.value)}
                  placeholder="Paste the job description here..."
                  rows={8}
                  style={textareaStyle}
                />
              </GlassCard>
            </section>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="primary" disabled={isLoading} onClick={runFullPackage}>
                {isLoading ? <Spinner size={16} /> : <span>&#9889;</span>}
                Full Package
              </Btn>
              <Btn variant="secondary" disabled={isLoading} onClick={runCVOnly}>
                CV + Analysis
              </Btn>
              <Btn variant="secondary" disabled={isLoading} onClick={runCoverOnly}>
                Cover Letter
              </Btn>
            </div>
          </>
        )}

        {/* ── Results Tab ───────────────────────────────────────────────── */}
        {tab === 'results' && (
          <>
            {viewingItem && (
              <GlassCard style={{
                padding: '12px 18px', marginBottom: 18,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 13, borderColor: 'rgba(232,93,117,0.2)',
                background: C.accentSoft,
              }}>
                <span>
                  <strong style={{ color: C.accent }}>{viewingItem.jobTitle}</strong>
                  <span style={{ color: C.textDim, marginLeft: 10 }}>
                    {new Date(viewingItem.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </span>
                <Btn variant="ghost" onClick={() => { setViewingItem(null); setRewrittenCV(''); setChangeSummary(''); setCoverLetter(''); }}>
                  Close
                </Btn>
              </GlassCard>
            )}

            {!hasResults && !isLoading ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>&#128203;</div>
                <p style={{ fontSize: 16, color: C.textDim, marginBottom: 8 }}>No results yet</p>
                <p style={{ fontSize: 13, color: C.textDim, opacity: 0.6 }}>
                  Head to <strong style={{ color: C.textMid }}>Input</strong> and submit your CV + job description.
                </p>
              </div>
            ) : (
              <>
                <ResultBlock title="Rewritten CV" emoji="&#128196;" content={rewrittenCV} loading={loadingCV} />
                <ResultBlock title="What Changed & Why" emoji="&#128269;" content={changeSummary} loading={loadingChanges} />
                <ResultBlock title="Cover Letter" emoji="&#9993;" content={coverLetter} loading={loadingCover} />
              </>
            )}
          </>
        )}

        {/* ── Library Tab ───────────────────────────────────────────────── */}
        {tab === 'library' && (
          <>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 20, flexWrap: 'wrap', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>&#128218;</span>
                <h2 style={{ fontFamily: C.fontHeading, fontSize: 22, fontWeight: 700, color: C.text }}>
                  Library
                  <span style={{
                    fontSize: 13, color: C.textDim, fontFamily: C.font,
                    fontWeight: 400, marginLeft: 10,
                  }}>
                    {history.length} application{history.length !== 1 ? 's' : ''}
                  </span>
                </h2>
              </div>
              {history.length >= 2 && (
                <Btn variant="secondary" disabled={loadingCross} onClick={runCrossAnalysis}>
                  {loadingCross ? <Spinner size={14} /> : <span>&#128269;</span>}
                  Cross Analysis
                </Btn>
              )}
            </div>

            <ResultBlock title="Cross-Application Analysis" emoji="&#128200;" content={crossAnalysis} loading={loadingCross} />

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>&#128218;</div>
                <p style={{ fontSize: 14, color: C.textDim }}>
                  Your tailored CVs will appear here. Each application is saved automatically.
                </p>
              </div>
            ) : (
              history.map(item => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  onView={() => viewHistoryItem(item)}
                  onDelete={() => deleteHistoryItem(item.id)}
                />
              ))
            )}
          </>
        )}
      </main>
    </>
  );
}
