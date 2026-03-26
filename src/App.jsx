import { useState, useEffect, useRef, useCallback } from 'react';

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

function readFileAsText(file) {
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

// ─── Styles ────────────────────────────────────────────────────────────────────

const C = {
  bg: '#0c0f1a',
  surface: '#141827',
  surfaceHover: '#1a1f35',
  border: '#1e2540',
  borderFocus: '#f59e0b',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  amber: '#f59e0b',
  amberDark: '#d97706',
  amberGlow: 'rgba(245,158,11,0.15)',
  green: '#22c55e',
  red: '#ef4444',
  redBg: 'rgba(239,68,68,0.12)',
  font: "'DM Sans', sans-serif",
  fontHeading: "'Playfair Display', serif",
  fontMono: "'JetBrains Mono', monospace",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ size = 18 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid ${C.border}`, borderTopColor: C.amber,
      borderRadius: '50%',
      animation: 'ats-spin 0.6s linear infinite',
    }} />
  );
}

function Btn({ children, variant = 'primary', disabled, onClick, style }) {
  const base = {
    fontFamily: C.font, fontSize: 14, fontWeight: 600,
    padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
    border: 'none', transition: 'all 0.2s',
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
    display: 'inline-flex', alignItems: 'center', gap: 8,
    ...style,
  };
  if (variant === 'primary') {
    Object.assign(base, {
      background: `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`,
      color: '#0c0f1a', fontWeight: 700,
    });
  } else if (variant === 'secondary') {
    Object.assign(base, {
      background: 'transparent', color: C.text,
      border: `1px solid ${C.border}`,
    });
  } else {
    Object.assign(base, {
      background: 'transparent', color: C.textDim,
      padding: '8px 14px', fontSize: 13,
    });
  }
  return <button style={base} disabled={disabled} onClick={onClick}>{children}</button>;
}

function DropZone({ onText, label }) {
  const [over, setOver] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      setFileName(file.name);
      onText(text);
    } catch {
      setFileName('Error reading file');
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files[0]); }}
      onClick={() => {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.txt,.doc,.docx,.rtf,.pdf';
        inp.onchange = () => handleFile(inp.files[0]);
        inp.click();
      }}
      style={{
        border: `2px dashed ${over ? C.amber : C.border}`,
        borderRadius: 8, padding: '20px 16px',
        textAlign: 'center', cursor: 'pointer',
        background: over ? C.amberGlow : 'transparent',
        transition: 'all 0.2s', marginBottom: 10,
        color: C.textDim, fontSize: 13,
      }}
    >
      {fileName
        ? <span style={{ color: C.amber }}>{fileName}</span>
        : (label || 'Drop a file here or click to upload (.txt, .doc, .docx, .rtf, .pdf)')
      }
    </div>
  );
}

function ResultBlock({ title, content, loading }) {
  if (!content && !loading) return null;

  const copy = () => { navigator.clipboard.writeText(content); };
  const download = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: 20, marginBottom: 16,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12,
      }}>
        <h3 style={{
          fontFamily: C.fontHeading, fontSize: 18, color: C.text, fontWeight: 700,
        }}>{title}</h3>
        {content && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={copy}>Copy</Btn>
            <Btn variant="ghost" onClick={download}>Download .txt</Btn>
          </div>
        )}
      </div>
      {loading && !content ? (
        <div style={{ textAlign: 'center', padding: 30 }}><Spinner size={24} /></div>
      ) : (
        <pre style={{
          fontFamily: C.fontMono, fontSize: 13, lineHeight: 1.7,
          color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 500, overflowY: 'auto', margin: 0,
          padding: 16, background: C.bg, borderRadius: 8,
        }}>{content}</pre>
      )}
    </div>
  );
}

function HistoryCard({ item, onView, onDelete }) {
  const date = new Date(item.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const badges = [
    item.hasCV && 'CV',
    item.hasCover && 'Cover',
    item.hasChanges && 'Analysis',
  ].filter(Boolean);

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: 16, marginBottom: 10,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 10,
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{item.jobTitle}</div>
        <div style={{ fontSize: 12, color: C.textDim, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{date}</span>
          {badges.map(b => (
            <span key={b} style={{
              background: C.amberGlow, color: C.amber,
              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            }}>{b}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="secondary" onClick={onView} style={{ padding: '6px 14px', fontSize: 13 }}>View</Btn>
        <Btn variant="ghost" onClick={onDelete} style={{ color: C.red, fontSize: 13 }}>Delete</Btn>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('input');
  const [cvText, setCvText] = useState('');
  const [jobText, setJobText] = useState('');
  const [savedCV, setSavedCV] = useState('');
  const [error, setError] = useState('');

  // Results
  const [rewrittenCV, setRewrittenCV] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [loadingCV, setLoadingCV] = useState(false);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [loadingCover, setLoadingCover] = useState(false);

  // Library
  const [history, setHistory] = useState([]);
  const [viewingItem, setViewingItem] = useState(null);
  const [crossAnalysis, setCrossAnalysis] = useState('');
  const [loadingCross, setLoadingCross] = useState(false);

  // Loading flag
  const isLoading = loadingCV || loadingChanges || loadingCover;

  // Init
  useEffect(() => {
    const saved = loadBaseCV();
    if (saved) { setSavedCV(saved); setCvText(saved); }
    setHistory(loadHistory());
  }, []);

  // Save to history helper
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

      // Now get change summary
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

      // Attach to most recent if it lacks a cover, else new entry
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

  return (
    <>
      <style>{`
        @keyframes ats-spin { to { transform: rotate(360deg); } }
        textarea:focus { outline: none; border-color: ${C.amber} !important; box-shadow: 0 0 0 3px ${C.amberGlow} !important; }
      `}</style>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(12,15,26,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '16px 20px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{
            fontFamily: C.fontHeading, fontSize: 28, fontWeight: 800,
            color: C.text, marginBottom: 4,
          }}>
            ATS<span style={{ color: C.amber, margin: '0 2px' }}>.</span>rewrite
          </h1>
          <p style={{ fontSize: 13, color: C.textDim, marginBottom: 14 }}>
            Tailored CVs & cover letters that get past the bots — and impress the humans.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            {['input', 'results', 'library'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                fontFamily: C.font, fontSize: 13, fontWeight: 600,
                padding: '8px 18px', borderRadius: 6, border: 'none',
                cursor: 'pointer', transition: 'all 0.2s',
                background: tab === t ? C.amberGlow : 'transparent',
                color: tab === t ? C.amber : C.textDim,
                borderBottom: tab === t ? `2px solid ${C.amber}` : '2px solid transparent',
                boxShadow: tab === t ? `0 0 12px ${C.amberGlow}` : 'none',
                position: 'relative',
              }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {t === 'results' && hasResults && (
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', background: C.green,
                    position: 'absolute', top: 6, right: 6,
                  }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* Error Banner */}
        {error && (
          <div style={{
            background: C.redBg, border: `1px solid ${C.red}`,
            borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 14, color: '#fca5a5',
          }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{
              background: 'none', border: 'none', color: '#fca5a5',
              cursor: 'pointer', fontSize: 18, lineHeight: 1,
            }}>&times;</button>
          </div>
        )}

        {/* ── Input Tab ─────────────────────────────────────────────────── */}
        {tab === 'input' && (
          <>
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: C.fontHeading, fontSize: 20, marginBottom: 12 }}>Your CV</h2>
              <DropZone onText={setCvText} />
              <textarea
                value={cvText}
                onChange={e => setCvText(e.target.value)}
                placeholder="Or paste your CV here..."
                rows={10}
                style={{
                  width: '100%', fontFamily: C.fontMono, fontSize: 13,
                  background: C.surface, color: C.text, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: 14, resize: 'vertical',
                  lineHeight: 1.6,
                }}
              />
              <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {savedCV ? (
                  <>
                    <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>Saved &#10003;</span>
                    <Btn variant="ghost" onClick={handleClearCV}>Clear saved</Btn>
                  </>
                ) : cvText.trim() ? (
                  <Btn variant="secondary" onClick={handleSaveCV} style={{ fontSize: 13 }}>
                    Save for next time
                  </Btn>
                ) : null}
              </div>
              {savedCV && (
                <p style={{ fontSize: 12, color: C.textDim, marginTop: 8 }}>
                  Your CV is saved in this browser. Next time, just paste a new job description and hit go.
                </p>
              )}
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: C.fontHeading, fontSize: 20, marginBottom: 12 }}>Job Description</h2>
              <DropZone onText={setJobText} label="Drop a job description file or click to upload" />
              <textarea
                value={jobText}
                onChange={e => setJobText(e.target.value)}
                placeholder="Paste the job description here..."
                rows={8}
                style={{
                  width: '100%', fontFamily: C.fontMono, fontSize: 13,
                  background: C.surface, color: C.text, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: 14, resize: 'vertical',
                  lineHeight: 1.6,
                }}
              />
            </section>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="primary" disabled={isLoading} onClick={runFullPackage}>
                {isLoading ? <Spinner size={16} /> : null}
                &#9889; Full Package — CV + Cover + Analysis
              </Btn>
              <Btn variant="secondary" disabled={isLoading} onClick={runCVOnly}>
                CV + Analysis Only
              </Btn>
              <Btn variant="secondary" disabled={isLoading} onClick={runCoverOnly}>
                Cover Letter Only
              </Btn>
            </div>
          </>
        )}

        {/* ── Results Tab ───────────────────────────────────────────────── */}
        {tab === 'results' && (
          <>
            {viewingItem && (
              <div style={{
                background: C.amberGlow, border: `1px solid ${C.amber}`,
                borderRadius: 8, padding: '10px 16px', marginBottom: 16,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 13,
              }}>
                <span>
                  <strong style={{ color: C.amber }}>{viewingItem.jobTitle}</strong>
                  <span style={{ color: C.textDim, marginLeft: 10 }}>
                    {new Date(viewingItem.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </span>
                <Btn variant="ghost" onClick={() => { setViewingItem(null); setRewrittenCV(''); setChangeSummary(''); setCoverLetter(''); }}>
                  Close
                </Btn>
              </div>
            )}

            {!hasResults && !isLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textDim }}>
                <p style={{ fontSize: 15, marginBottom: 8 }}>No results yet.</p>
                <p style={{ fontSize: 13 }}>Head to <strong>Input</strong> and submit your CV + job description.</p>
              </div>
            ) : (
              <>
                <ResultBlock title="Rewritten CV" content={rewrittenCV} loading={loadingCV} />
                <ResultBlock title="What Changed & Why" content={changeSummary} loading={loadingChanges} />
                <ResultBlock title="Cover Letter" content={coverLetter} loading={loadingCover} />
              </>
            )}
          </>
        )}

        {/* ── Library Tab ───────────────────────────────────────────────── */}
        {tab === 'library' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ fontFamily: C.fontHeading, fontSize: 20 }}>
                Application Library <span style={{ fontSize: 14, color: C.textDim, fontFamily: C.font }}>({history.length})</span>
              </h2>
              {history.length >= 2 && (
                <Btn variant="secondary" disabled={loadingCross} onClick={runCrossAnalysis}>
                  {loadingCross ? <Spinner size={14} /> : null}
                  &#128269; Cross-Application Analysis
                </Btn>
              )}
            </div>

            <ResultBlock title="Cross-Application Analysis" content={crossAnalysis} loading={loadingCross} />

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textDim }}>
                <p style={{ fontSize: 14 }}>Your tailored CVs will appear here. Each application is saved automatically.</p>
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
