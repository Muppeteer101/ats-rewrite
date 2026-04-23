'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type {
  ATSConfidence,
  CoverLetter,
  JobAnalysis,
  NarrationEvent,
  RecruiterVerdict,
  RewriteOutput,
  RoleMatch,
  Teaser,
} from '@/src/engine/schemas';
import { TemplatePicker } from './TemplatePicker';
import { UpsellModal } from './UpsellModal';

type Stage =
  | 'priming'        // initial render, before useEffect fires
  | 'analyzing'      // SSE: /api/rewrite/analyze
  | 'teaser'         // show initial scores + gap confirmation form
  | 'rescoring'      // SSE: /api/rewrite/rescore
  | 'new-scores'     // show new scores + paywall CTA (NO detail shown)
  | 'finalizing'     // SSE: /api/rewrite/finalize (paid)
  | 'done'           // full ResultView
  | 'error'
  | 'out-of-credits';

type ResultHeader = {
  jobTitle: string;
  matchScore: number;
  atsPercentage: number;
  atsRating: ATSConfidence['rating'];
  verdict: RecruiterVerdict['decision'];
};

type FullResult = ResultHeader & {
  jobAnalysis: JobAnalysis;
  cvAnalysis: unknown;
  roleMatch: RoleMatch;
  recruiterVerdict: RecruiterVerdict;
  rewrite: RewriteOutput;
  coverLetter: CoverLetter;
  changesMade: string[];
  atsConfidence: ATSConfidence;
};

/**
 * Multi-stage runner for the three-stage engine:
 *   1. analyze (FREE)    — show scores + ask about gaps
 *   2. rescore (FREE)    — re-score with confirmed gaps, show NEW scores
 *   3. finalize (PAID)   — rewrite resume + cover letter, show full debrief
 *
 * The teaser + new-scores views deliberately withhold all reasoning. Only
 * the three headline numbers (match / verdict / ATS) + gap labels are shown
 * before the paywall. Everything else — why the score is what it is, what
 * works in their favour, what would change the decision, the rewrite, the
 * cover letter, the ATS breakdown — is locked until they pay.
 */
export function RewriteRunner({ draftId }: { draftId: string }) {
  const searchParams = useSearchParams();
  const [lines, setLines] = useState<NarrationEvent[]>([]);
  const [stage, setStage] = useState<Stage>('priming');
  const [error, setError] = useState<string | null>(null);

  const [initialTeaser, setInitialTeaser] = useState<Teaser | null>(null);
  const [newTeaser, setNewTeaser] = useState<Teaser | null>(null);
  const [finalHeader, setFinalHeader] = useState<ResultHeader | null>(null);

  const [confirmedGaps, setConfirmedGaps] = useState<string[]>([]);
  const [rewriteId, setRewriteId] = useState<string>('');
  const startedRef = useRef(false);

  // Fire stage 1 once on mount. Checkout resume is handled separately: if
  // ?topup=success is on the URL we know the user just came back from Stripe
  // — skip straight to finalize (the snapshot is still in Redis).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const toppedUp = searchParams.get('topup') === 'success';
    if (toppedUp && typeof window !== 'undefined') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState(null, '', cleanUrl);
    }

    if (toppedUp) {
      // Resume at finalize with retry — webhook may still be processing.
      void runFinalize(3);
      return;
    }

    const raw = sessionStorage.getItem(`rewrite-payload:${draftId}`);
    if (!raw) {
      setError('Lost your input on the way here. Go back and try again.');
      setStage('error');
      return;
    }
    void runAnalyze(JSON.parse(raw));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ────────────────── SSE helper ────────────────── */
  async function streamSSE(
    url: string,
    body: unknown,
    onEvent: (e: NarrationEvent) => void,
  ): Promise<{ status: number; ok: boolean }> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 402) return { status: 402, ok: false };
    if (!res.ok || !res.body) throw new Error(`Engine returned ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const block of events) {
        const line = block.trim();
        if (!line.startsWith('data:')) continue;
        const json = line.slice(5).trim();
        if (!json) continue;
        try {
          onEvent(JSON.parse(json) as NarrationEvent);
        } catch { /* skip malformed */ }
      }
    }
    return { status: 200, ok: true };
  }

  /* ────────────────── Stage 1: Analyze ────────────────── */
  async function runAnalyze(payload: Record<string, unknown>) {
    setStage('analyzing');
    setLines([]);
    try {
      await streamSSE(
        '/api/rewrite/analyze',
        { ...payload, draftId },
        (evt) => {
          setLines((prev) => [...prev, evt]);
          if (evt.type === 'teaser') setInitialTeaser(evt.data);
          if (evt.type === 'result') setStage('teaser');
          if (evt.type === 'error') {
            setError(evt.message);
            setStage('error');
          }
        },
      );
    } catch (e) {
      setError((e as Error).message);
      setStage('error');
    }
  }

  /* ────────────────── Stage 2: Rescore ────────────────── */
  async function runRescore() {
    setStage('rescoring');
    setLines([]);
    try {
      await streamSSE(
        '/api/rewrite/rescore',
        { analysisId: draftId, confirmedGaps },
        (evt) => {
          setLines((prev) => [...prev, evt]);
          if (evt.type === 'teaser') setNewTeaser(evt.data);
          if (evt.type === 'result') setStage('new-scores');
          if (evt.type === 'error') {
            setError(evt.message);
            setStage('error');
          }
        },
      );
    } catch (e) {
      setError((e as Error).message);
      setStage('error');
    }
  }

  /* ────────────────── Stage 3: Finalize (paid) ────────────────── */
  async function runFinalize(retriesLeft = 0) {
    setStage('finalizing');
    setLines([]);
    try {
      const result = await streamSSE(
        '/api/rewrite/finalize',
        { analysisId: draftId },
        (evt) => {
          setLines((prev) => [...prev, evt]);
          if (evt.type === 'result') {
            setRewriteId(evt.id);
            void fetch(`/api/rewrite-meta/${evt.id}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((meta) => {
                if (meta) setFinalHeader(meta as ResultHeader);
                setStage('done');
              });
          }
          if (evt.type === 'error') {
            setError(evt.message);
            setStage('error');
          }
        },
      );
      if (result.status === 402) {
        if (retriesLeft > 0) {
          setLines((prev) => [
            ...prev,
            { type: 'system', line: `› Credits syncing from payment… retrying (${retriesLeft} left)` },
          ]);
          await new Promise((r) => setTimeout(r, 2500));
          return runFinalize(retriesLeft - 1);
        }
        setStage('out-of-credits');
      }
    } catch (e) {
      setError((e as Error).message);
      setStage('error');
    }
  }

  /* ────────────────── Render ────────────────── */
  const isStreaming = stage === 'analyzing' || stage === 'rescoring' || stage === 'finalizing';

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-10">
      {stage !== 'done' && stage !== 'error' && (
        <>
          <span className="badge badge-purple mb-4">{stageLabel(stage)}</span>
          <h1 className="display-large mb-3">{stageHeadline(stage, initialTeaser, newTeaser)}</h1>
          <p className="body-large mb-8 max-w-[640px]">{stageSubhead(stage)}</p>
        </>
      )}

      {stage === 'done' && finalHeader && <ResultHeaderBlock header={finalHeader} />}

      {isStreaming && (
        <div className="mb-8">
          <ProgressConsole lines={lines} phase="streaming" />
        </div>
      )}

      {stage === 'teaser' && initialTeaser && (
        <TeaserAndGapsCard
          teaser={initialTeaser}
          confirmedGaps={confirmedGaps}
          setConfirmedGaps={setConfirmedGaps}
          onContinue={runRescore}
          onSkip={() => {
            setConfirmedGaps([]);
            void runRescore();
          }}
        />
      )}

      {stage === 'new-scores' && newTeaser && (
        <NewScoresAndUnlockCard
          initial={initialTeaser}
          updated={newTeaser}
          onUnlock={() => runFinalize(0)}
        />
      )}

      {stage === 'done' && finalHeader && rewriteId && <ResultView rewriteId={rewriteId} />}

      {stage === 'error' && (
        <div className="card p-6" style={{ borderColor: 'rgba(234,34,97,0.4)' }}>
          <h3 className="sub-heading mb-2" style={{ color: 'var(--color-heading)' }}>
            Something went wrong
          </h3>
          <p className="body mb-4">{error}</p>
          <Link href="/new" className="btn btn-sm btn-neutral">Start over</Link>
        </div>
      )}

      {stage === 'out-of-credits' && (
        <UpsellModal resumeDraftId={draftId} onClose={() => location.assign('/dashboard')} />
      )}
    </div>
  );
}

function stageLabel(s: Stage): string {
  switch (s) {
    case 'analyzing':  return 'Initial appraisal · FREE';
    case 'teaser':     return 'Initial results · FREE';
    case 'rescoring':  return 'Rescoring with your answers · FREE';
    case 'new-scores': return 'Your updated scores · FREE';
    case 'finalizing': return 'Producing your rewrite';
    default:           return 'Getting ready';
  }
}
function stageHeadline(s: Stage, initial: Teaser | null, next: Teaser | null): string {
  if (s === 'analyzing')  return 'Analysing your resume against the role…';
  if (s === 'teaser')     return initial ? `Your initial scores${initial.jobTitle ? ` — ${initial.jobTitle}` : ''}` : 'Initial scores';
  if (s === 'rescoring')  return 'Rescoring with your confirmed experience…';
  if (s === 'new-scores') return next ? 'Your updated scores' : 'Updated scores';
  if (s === 'finalizing') return 'Rewriting your resume and cover letter…';
  return 'Getting ready';
}
function stageSubhead(s: Stage): string {
  if (s === 'analyzing')  return 'Five passes — job, resume, role match, recruiter verdict, ATS. No payment, just the real numbers.';
  if (s === 'teaser')     return 'Before you go further — confirm any experience we flagged as a gap. We’ll rescore in seconds.';
  if (s === 'rescoring')  return 'Re-running the scoring with the experience you just confirmed.';
  if (s === 'new-scores') return 'These are your new numbers after confirming your experience. Still free.';
  if (s === 'finalizing') return 'Producing your rewritten resume, tailored cover letter, and final ATS check.';
  return '';
}

/* ────────────────────── Teaser + gap confirmation (stage 2 handoff) ────────────────────── */

function TeaserAndGapsCard({
  teaser,
  confirmedGaps,
  setConfirmedGaps,
  onContinue,
  onSkip,
}: {
  teaser: Teaser;
  confirmedGaps: string[];
  setConfirmedGaps: (g: string[]) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  // answers[gap] = 'yes' | 'no' | undefined (not answered)
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no' | undefined>>({});

  function choose(gap: string, value: 'yes' | 'no') {
    const next = { ...answers, [gap]: value };
    setAnswers(next);
    setConfirmedGaps(Object.entries(next).filter(([, v]) => v === 'yes').map(([g]) => g));
  }

  const allAnswered = teaser.gaps.length === 0 || teaser.gaps.every((g) => answers[g]);
  const anyYes = confirmedGaps.length > 0;

  return (
    <div className="space-y-6">
      <ScoreTeaserStrip teaser={teaser} />

      {teaser.gaps.length === 0 ? (
        <div className="card-elevated p-7">
          <h3 className="sub-heading mb-2">No gaps flagged</h3>
          <p className="body mb-4">Your resume already covers the role’s stated requirements. Ready for the rewrite?</p>
          <div className="flex gap-3 flex-wrap">
            <button onClick={onSkip} className="btn btn-primary">Unlock the full debrief + rewrite</button>
          </div>
        </div>
      ) : (
        <div className="card-elevated p-7">
          <h3 className="sub-heading mb-2">Here are the gaps we found between your resume and the job description</h3>
          <p className="body mb-5" style={{ color: 'var(--color-body)' }}>
            Can you confirm if you have this experience? Anything you say <strong>Yes</strong> to, we’ll weave naturally into the rewrite — no inventing numbers or clients, just surfacing what you have. This will rescore in seconds.
          </p>

          <div
            style={{
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              background: 'var(--color-surface)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 90px',
                padding: '10px 16px',
                background: 'var(--color-surface-soft)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-body)',
              }}
            >
              <span>Gap</span>
              <span style={{ textAlign: 'center' }}>Yes</span>
              <span style={{ textAlign: 'center' }}>No</span>
            </div>
            {teaser.gaps.map((gap) => (
              <label
                key={gap}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 90px 90px',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderTop: '1px solid var(--color-border)',
                  fontSize: 15,
                  color: 'var(--color-heading)',
                }}
              >
                <span>{gap}</span>
                <input
                  type="radio"
                  name={`gap-${gap}`}
                  checked={answers[gap] === 'yes'}
                  onChange={() => choose(gap, 'yes')}
                  style={{ justifySelf: 'center', width: 18, height: 18, accentColor: 'var(--color-purple)' }}
                  aria-label={`Yes, I have ${gap}`}
                />
                <input
                  type="radio"
                  name={`gap-${gap}`}
                  checked={answers[gap] === 'no'}
                  onChange={() => choose(gap, 'no')}
                  style={{ justifySelf: 'center', width: 18, height: 18, accentColor: 'var(--color-purple)' }}
                  aria-label={`No, I don't have ${gap}`}
                />
              </label>
            ))}
          </div>

          <div className="flex gap-3 flex-wrap mt-5">
            <button
              onClick={onContinue}
              disabled={!allAnswered}
              className="btn btn-primary"
              style={!allAnswered ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              {anyYes ? `Rescore with my ${confirmedGaps.length} confirmed${confirmedGaps.length === 1 ? '' : ' items'}` : 'Rescore (nothing to add)'}
            </button>
            <button onClick={onSkip} className="btn btn-neutral">Skip — rescore as-is</button>
          </div>
          <p className="caption mt-3">We only use Yes answers in the rewrite. No is treated as genuine-not-present.</p>
        </div>
      )}
    </div>
  );
}

/* ────────────────────── New-scores + paywall CTA (stage 4) ────────────────────── */

function NewScoresAndUnlockCard({
  initial,
  updated,
  onUnlock,
}: {
  initial: Teaser | null;
  updated: Teaser;
  onUnlock: () => void;
}) {
  return (
    <div className="space-y-6">
      <ScoreTeaserStrip teaser={updated} initial={initial} compareMode />

      <div className="card-elevated p-7" style={{ borderColor: 'rgba(184,163,255,0.4)' }}>
        <h3 className="sub-heading mb-2">Want the full debrief + your new resume and cover letter?</h3>
        <p className="body mb-1">Everything above is free. Below is what you get when you unlock:</p>
        <ul className="bullets mb-5">
          <li>The full recruiter verdict — what works in your favour, what works against you, what would change the decision.</li>
          <li>Your resume rewritten for this role — with your confirmed experience woven in naturally, ATS-friendly formatting, downloadable as PDF.</li>
          <li>A tailored cover letter, downloadable as PDF.</li>
          <li>A changes-log explaining every edit, so you can learn from it.</li>
          <li>A final ATS confidence rating on the rewritten resume.</li>
        </ul>
        <div className="flex gap-3 flex-wrap">
          <button onClick={onUnlock} className="btn btn-primary">Unlock the full debrief + rewrite</button>
          <Link href="/new" className="btn btn-neutral">Try a different role</Link>
        </div>
      </div>
    </div>
  );
}

/** Thin three-number strip — deliberately low-information.
 *  Shows headline match score + verdict + ATS only. No reasoning. */
function ScoreTeaserStrip({
  teaser,
  initial,
  compareMode,
}: {
  teaser: Teaser;
  initial?: Teaser | null;
  compareMode?: boolean;
}) {
  const delta = (now: number, was?: number) =>
    was == null ? null : now - was;

  const matchDelta = compareMode && initial ? delta(teaser.matchScore, initial.matchScore) : null;
  const atsDelta = compareMode && initial ? delta(teaser.atsPercentage, initial.atsPercentage) : null;

  return (
    <div className="card-elevated p-7">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
          alignItems: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 11, marginBottom: 8 }}>Role match</div>
          <ScoreRing score={teaser.matchScore} size={110} />
          {matchDelta != null && (
            <div className="caption" style={{ marginTop: 8, color: matchDelta >= 0 ? '#108c3d' : '#ea2261', fontWeight: 600 }}>
              {matchDelta >= 0 ? '+' : ''}{matchDelta} vs initial
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 11, marginBottom: 12 }}>Recruiter verdict</div>
          <VerdictPill value={teaser.verdictDecision} big />
          {compareMode && initial && initial.verdictDecision !== teaser.verdictDecision && (
            <div className="caption" style={{ marginTop: 8, fontWeight: 600 }}>
              was <VerdictPill value={initial.verdictDecision} />
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 11, marginBottom: 8 }}>ATS confidence</div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <AtsPill value={teaser.atsRating} big />
            <ScoreRing score={teaser.atsPercentage} size={90} label="pass likelihood" />
          </div>
          {atsDelta != null && (
            <div className="caption" style={{ marginTop: 8, color: atsDelta >= 0 ? '#108c3d' : '#ea2261', fontWeight: 600 }}>
              {atsDelta >= 0 ? '+' : ''}{atsDelta}% vs initial
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── Progress console ────────────────────── */

type StepState = { title: string; blurb: string; tone?: string; detail?: string; status: 'pending' | 'active' | 'done' };

const STEP_BLUEPRINT: { title: string; active: string; done: string; blurb: string }[] = [
  { title: 'Job description',    active: 'Analysing the job description',       done: 'Job description analysed',   blurb: 'Extracting must-haves, nice-to-haves, tone, and rejection risks.' },
  { title: 'Your resume',             active: 'Analysing your resume',                   done: 'Resume analysed',                 blurb: 'Mapping your demonstrated strengths, gaps, and presentation quality.' },
  { title: 'Role match score',    active: 'Scoring the role match',              done: 'Role match scored',           blurb: 'Measuring how your experience lines up against what this role actually needs.' },
  { title: 'Recruiter verdict',   active: 'Running the recruiter verdict',       done: 'Recruiter verdict reached',   blurb: 'Simulating a recruiter shortlisting you against 50 others.' },
  { title: 'Rewrite + cover',     active: 'Rewriting your resume and cover letter',  done: 'Rewrite complete',            blurb: 'Mirroring the role’s language where your experience supports it — no invention.' },
  { title: 'ATS confidence',      active: 'Running the ATS confidence check',    done: 'ATS confidence checked',      blurb: 'Checking your rewrite against how ATS platforms parse and rank resumes.' },
];

const MILESTONES: Record<string, number> = {
  boot: 4,
  p1Start: 8, p2Start: 10,
  p1Done: 20, p2Done: 32,
  p3Start: 36, p3Done: 48,
  p4Start: 52, p4Done: 64,
  p5Start: 68, p5Done: 86,
  p6Start: 90, p6Done: 100,
};

function deriveProgress(lines: NarrationEvent[]): { percent: number; steps: StepState[]; currentIndex: number } {
  const steps: StepState[] = STEP_BLUEPRINT.map((s) => ({ title: s.title, blurb: s.blurb, status: 'pending' }));
  let percent = lines.length === 0 ? 0 : MILESTONES.boot;

  for (const l of lines) {
    if (l.type === 'pass') {
      const i = l.pass - 1;
      if (steps[i] && steps[i].status === 'pending') steps[i].status = 'active';
      const key = `p${l.pass}Start`;
      if (MILESTONES[key] != null) percent = Math.max(percent, MILESTONES[key]);
    } else if (l.type === 'pass-complete') {
      const i = l.pass - 1;
      if (steps[i]) {
        steps[i].status = 'done';
        if ('tone' in l && l.tone) steps[i].tone = l.tone;
        const m = /^✓\s*[^:]+:\s*(.+)$/.exec(l.line);
        if (m) steps[i].detail = m[1];
      }
      const key = `p${l.pass}Done`;
      if (MILESTONES[key] != null) percent = Math.max(percent, MILESTONES[key]);
    }
  }

  const active = steps.findIndex((s) => s.status === 'active');
  const pending = steps.findIndex((s) => s.status === 'pending');
  return { percent, steps, currentIndex: active !== -1 ? active : pending };
}

function ProgressConsole({ lines, phase }: { lines: NarrationEvent[]; phase: 'priming' | 'streaming' | 'done' }) {
  const { percent: targetPercent, steps, currentIndex } = deriveProgress(lines);
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setDisplayPercent((prev) => {
        if (prev >= targetPercent) return prev;
        const gap = targetPercent - prev;
        const step = gap > 10 ? 1.5 : gap > 4 ? 0.6 : 0.2;
        return Math.min(targetPercent, Math.round((prev + step) * 10) / 10);
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [targetPercent]);

  const isDone = phase === 'done' || targetPercent >= 100;
  const shownIdx = isDone ? steps.length - 1 : currentIndex === -1 ? 0 : currentIndex;
  const current = STEP_BLUEPRINT[shownIdx] ?? STEP_BLUEPRINT[0];
  const headline = isDone ? 'Analysis complete' : phase === 'priming' ? 'Booting the engine' : current.active;
  const blurb = isDone
    ? 'Your score, verdict, rewritten resume, cover letter, and ATS rating are below.'
    : phase === 'priming'
      ? 'Reading your input and preparing the six-pass pipeline.'
      : current.blurb;

  const RADIUS = 62;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashoffset = CIRC - (displayPercent / 100) * CIRC;

  return (
    <div className="progress-console" role="status" aria-live="polite">
      <div className="progress-ring" aria-label={`${Math.round(displayPercent)} percent complete`}>
        <svg viewBox="0 0 140 140">
          <defs>
            <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#b8a3ff" />
              <stop offset="100%" stopColor="#f96bee" />
            </linearGradient>
          </defs>
          <circle className="track" cx="70" cy="70" r={RADIUS} />
          <circle
            className="fill"
            cx="70"
            cy="70"
            r={RADIUS}
            strokeDasharray={CIRC}
            strokeDashoffset={dashoffset}
          />
        </svg>
        <span className="pct">{Math.round(displayPercent)}%</span>
      </div>

      <div className="progress-current">
        <div className="label">{isDone ? 'Done' : `Step ${Math.max(1, shownIdx + 1)} of 6`}</div>
        <h3>{headline}</h3>
        <p>{blurb}</p>

        <div className="progress-steps">
          {steps.map((s, i) => {
            const cls =
              s.status === 'active' ? 'progress-step active'
              : s.status === 'done' ? `progress-step done${s.tone ? ` tone-${s.tone}` : ''}`
              : 'progress-step';
            return (
              <div key={i} className={cls}>
                <span className="dot" />
                <span>{STEP_BLUEPRINT[i].title}</span>
                <span className="detail">{s.status === 'done' ? s.detail ?? '' : s.status === 'active' ? 'in progress…' : ''}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── Result View ────────────────────── */

function ResultHeaderBlock({ header }: { header: ResultHeader }) {
  return (
    <div className="mb-8">
      <span className="badge badge-success mb-4">Analysis complete</span>
      <h1 className="display-large mb-2">
        For <span style={{ color: 'var(--color-purple)' }}>{header.jobTitle}</span>
      </h1>
      <p className="body-large" style={{ color: 'var(--color-body)' }}>
        Match score <strong style={{ color: 'var(--color-heading)' }}>{header.matchScore}</strong> ·{' '}
        recruiter verdict <VerdictPill value={header.verdict} /> · ATS confidence{' '}
        <AtsPill value={header.atsRating} /> ({header.atsPercentage}%)
      </p>
    </div>
  );
}

function ResultView({ rewriteId }: { rewriteId: string }) {
  const [data, setData] = useState<FullResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!rewriteId) return;
    fetch(`/api/rewrite-meta/${rewriteId}?full=1`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Load failed: ${r.status}`);
        return (await r.json()) as FullResult;
      })
      .then(setData)
      .catch((e) => setErr((e as Error).message));
  }, [rewriteId]);

  if (err) return <div className="caption" style={{ color: 'var(--color-ruby)' }}>Couldn’t load full result: {err}</div>;
  if (!data) return <div className="caption">Loading result…</div>;

  return (
    <div className="space-y-6">
      {/* 1. Role Match Score */}
      <RoleMatchCard data={data.roleMatch} />

      {/* 2. Recruiter Verdict */}
      <VerdictCard data={data.recruiterVerdict} />

      {/* 3. What Needs to Change */}
      <WhatToChangeCard data={data.recruiterVerdict} />

      {/* 4 + 5. Rewritten resume download (covers both screen preview + PDF) */}
      <TemplatePicker rewriteId={rewriteId} />

      {/* Cover Letter card — on-screen preview + PDF download */}
      <CoverLetterCard rewriteId={rewriteId} letter={data.coverLetter} />

      {/* 6. Changes Made */}
      <ChangesMadeCard items={data.changesMade} />

      {/* 7. ATS Confidence */}
      <AtsConfidenceCard data={data.atsConfidence} />
    </div>
  );
}

/* ────────────────────── Cards ────────────────────── */

function RoleMatchCard({ data }: { data: RoleMatch }) {
  const cats: Array<[string, { score: number; reasoning: string }]> = [
    ['Must-have skills', data.categoryScores.mustHaveSkills],
    ['Nice-to-have skills', data.categoryScores.niceToHaveSkills],
    ['Seniority & experience', data.categoryScores.seniorityAndExperience],
    ['Industry relevance', data.categoryScores.industryRelevance],
    ['Language alignment', data.categoryScores.languageAlignment],
  ];

  return (
    <div className="card-elevated p-7">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <h3 className="sub-heading mb-1">Role match score</h3>
          <p className="caption">How well your resume aligns with this role’s stated requirements.</p>
        </div>
        <ScoreRing score={data.overallScore} />
      </div>

      <p className="body mb-5">{data.summary}</p>

      <div className="space-y-2 mb-5">
        {cats.map(([label, v]) => (
          <ScoreBar key={label} label={label} score={v.score} reasoning={v.reasoning} />
        ))}
      </div>

      {data.strengths.length > 0 && (
        <>
          <div className="text-[11px] uppercase tracking-[0.14em] mt-5 mb-2" style={{ color: 'var(--color-body)' }}>
            Strengths for this role
          </div>
          <ul className="bullets">
            {data.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}
      {data.gaps.length > 0 && (
        <>
          <div className="text-[11px] uppercase tracking-[0.14em] mt-5 mb-2" style={{ color: 'var(--color-body)' }}>
            Gaps for this role
          </div>
          <ul className="bullets">
            {data.gaps.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}

      <div className="mt-5 p-4 rounded-[6px]" style={{ background: 'var(--color-surface-soft)' }}>
        <div className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ color: 'var(--color-body)' }}>
          Honest assessment · {data.pilePosition} pile
        </div>
        <p className="body" style={{ fontStyle: 'italic' }}>{data.honestAssessment}</p>
      </div>
    </div>
  );
}

function VerdictCard({ data }: { data: RecruiterVerdict }) {
  return (
    <div className="card-elevated p-7">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="sub-heading mb-1">Recruiter verdict</h3>
          <p className="caption">What a recruiter would say to the hiring manager.</p>
        </div>
        <VerdictPill value={data.decision} big />
      </div>

      <p className="body mb-5"><strong>{data.oneSentenceReason}</strong></p>

      {data.inFavour.length > 0 && (
        <>
          <div className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--color-body)' }}>
            What works in their favour
          </div>
          <ul className="bullets mb-5">
            {data.inFavour.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}

      {data.against.length > 0 && (
        <>
          <div className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--color-body)' }}>
            What works against them
          </div>
          <ul className="bullets">
            {data.against.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}

      <p className="caption mt-5" style={{ fontStyle: 'italic' }}>{data.disclaimer}</p>
    </div>
  );
}

function WhatToChangeCard({ data }: { data: RecruiterVerdict }) {
  if (data.whatWouldChangeIt.length === 0) return null;
  const heading = data.decision === 'YES' ? 'What would make it even stronger' : 'What would change the decision';
  return (
    <div className="card-elevated p-7">
      <h3 className="sub-heading mb-1">{heading}</h3>
      <p className="caption mb-4">
        {data.decision === 'YES'
          ? 'Already a yes — but here’s how to push it from strong to undeniable.'
          : 'Specific changes that would move the verdict toward YES.'}
      </p>
      <ul className="bullets">
        {data.whatWouldChangeIt.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}

function CoverLetterCard({ rewriteId, letter }: { rewriteId: string; letter: CoverLetter }) {
  const downloadHref = `/api/pdf/${rewriteId}?template=cover-letter&download=1`;
  return (
    <div className="card-elevated p-7">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="sub-heading mb-1">Cover letter</h3>
          <p className="caption">Tailored to the JD. Download the PDF or copy below.</p>
        </div>
        <a href={downloadHref} className="btn btn-sm btn-primary">Download PDF</a>
      </div>
      <div className="p-5 rounded-[6px]" style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)' }}>
        <p className="body mb-3">{letter.greeting}</p>
        {letter.paragraphs.map((p, i) => (
          <p key={i} className="body mb-3">{p}</p>
        ))}
        <p className="body mt-4">{letter.signoff}</p>
        <p className="body">{letter.signature}</p>
      </div>
    </div>
  );
}

function ChangesMadeCard({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="card-elevated p-7">
      <h3 className="sub-heading mb-1">Changes made</h3>
      <p className="caption mb-4">What changed from your original to the rewrite, and why — so you can learn from it.</p>
      <ul className="bullets">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}

function AtsConfidenceCard({ data }: { data: ATSConfidence }) {
  const cats: Array<[string, { score: number; reasoning: string }]> = [
    ['Keyword match', data.scoring.keywordMatch],
    ['Keyword density', data.scoring.keywordDensity],
    ['Section structure', data.scoring.sectionStructure],
    ['Formatting compatibility', data.scoring.formattingCompatibility],
    ['File format readiness', data.scoring.fileFormatReadiness],
    ['Seniority signal', data.scoring.seniorityAlignment],
  ];
  return (
    <div className="card-elevated p-7">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <h3 className="sub-heading mb-1">ATS confidence rating</h3>
          <p className="caption">Likelihood of passing initial automated screening for this role.</p>
        </div>
        <div className="flex items-center gap-4">
          <AtsPill value={data.rating} big />
          <ScoreRing score={data.percentage} label="pass likelihood" />
        </div>
      </div>

      <p className="body mb-5">{data.summary}</p>

      <div className="space-y-2 mb-5">
        {cats.map(([label, v]) => (
          <ScoreBar key={label} label={label} score={v.score} reasoning={v.reasoning} />
        ))}
      </div>

      {data.whatsWorking.length > 0 && (
        <>
          <div className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--color-body)' }}>
            What’s working for ATS
          </div>
          <ul className="bullets mb-5">
            {data.whatsWorking.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}

      {data.remainingRisks.length > 0 && (
        <>
          <div className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--color-body)' }}>
            Remaining risks
          </div>
          <ul className="bullets mb-5">
            {data.remainingRisks.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}

      <div className="p-4 rounded-[6px]" style={{ background: 'var(--color-surface-soft)' }}>
        <p className="body" style={{ fontStyle: 'italic' }}>{data.finalStatement}</p>
      </div>
    </div>
  );
}

/* ────────────────────── Visual primitives ────────────────────── */

function ScoreRing({ score, label, size = 84 }: { score: number; label?: string; size?: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const colour = clamped >= 75 ? 'var(--color-success-text, #108c3d)' : clamped >= 50 ? 'var(--color-purple)' : 'var(--color-ruby, #ea2261)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={5} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={colour} strokeWidth={5}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.28, fontWeight: 300, color: 'var(--color-heading)',
          letterSpacing: '-0.02em',
        }}>
          {clamped}
        </div>
      </div>
      {label && <span className="caption" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>}
    </div>
  );
}

function ScoreBar({ label, score, reasoning }: { label: string; score: number; reasoning: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const colour = clamped >= 75 ? 'var(--color-success-text, #108c3d)' : clamped >= 50 ? 'var(--color-purple)' : 'var(--color-ruby, #ea2261)';
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm" style={{ color: 'var(--color-heading)' }}>{label}</span>
        <span className="tabular text-sm" style={{ color: 'var(--color-body)' }}>{clamped}/100</span>
      </div>
      <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${clamped}%`, height: '100%', background: colour, transition: 'width 0.6s ease' }} />
      </div>
      {reasoning && <p className="caption mt-1">{reasoning}</p>}
    </div>
  );
}

function VerdictPill({ value, big }: { value: RecruiterVerdict['decision']; big?: boolean }) {
  const map = {
    YES:   { bg: 'rgba(16,140,61,0.12)', fg: '#108c3d' },
    MAYBE: { bg: 'rgba(160,100,30,0.12)', fg: '#a0641e' },
    NO:    { bg: 'rgba(234,34,97,0.12)',  fg: '#ea2261' },
  } as const;
  const s = map[value];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: big ? '6px 14px' : '2px 10px',
      borderRadius: 999,
      background: s.bg, color: s.fg,
      fontWeight: 700, fontSize: big ? 13 : 11,
      letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.fg }} />
      {value}
    </span>
  );
}

function AtsPill({ value, big }: { value: ATSConfidence['rating']; big?: boolean }) {
  const map = {
    HIGH:   { bg: 'rgba(16,140,61,0.12)', fg: '#108c3d' },
    MEDIUM: { bg: 'rgba(160,100,30,0.12)', fg: '#a0641e' },
    LOW:    { bg: 'rgba(234,34,97,0.12)',  fg: '#ea2261' },
  } as const;
  const s = map[value];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: big ? '6px 14px' : '2px 10px',
      borderRadius: 999,
      background: s.bg, color: s.fg,
      fontWeight: 700, fontSize: big ? 13 : 11,
      letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>
      {value}
    </span>
  );
}
