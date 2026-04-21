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
} from '@/src/engine/schemas';
import { TemplatePicker } from './TemplatePicker';
import { UpsellModal } from './UpsellModal';

type Phase = 'priming' | 'streaming' | 'done' | 'error' | 'out-of-credits';

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
 * Runs the six-pass engine for a given draft ID and renders the streaming
 * narration + the seven-block result view.
 *
 * Checkout resume:
 *   - UpsellModal passes this page's draftId through to /api/checkout.
 *   - On success Stripe returns here with ?topup=success.
 *   - That query param flips the runner back to 'priming' and re-executes
 *     the engine call using the sessionStorage payload. The webhook has
 *     usually credited by the time the browser redirect completes, but we
 *     retry up to three times with a short backoff to absorb webhook lag.
 */
export function RewriteRunner({ draftId }: { draftId: string }) {
  const searchParams = useSearchParams();
  const [lines, setLines] = useState<NarrationEvent[]>([]);
  const [phase, setPhase] = useState<Phase>('priming');
  const [error, setError] = useState<string | null>(null);
  const [header, setHeader] = useState<ResultHeader | null>(null);
  const startedRef = useRef(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const raw = sessionStorage.getItem(`rewrite-payload:${draftId}`);
    if (!raw) {
      setError('Lost your input on the way here. Go back and try again.');
      setPhase('error');
      return;
    }

    const toppedUp = searchParams.get('topup') === 'success';
    const payload = JSON.parse(raw);

    // If we landed back here from Stripe, clear the query params so a page
    // reload doesn't look like another post-checkout resume.
    if (toppedUp && typeof window !== 'undefined') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState(null, '', cleanUrl);
    }

    void run(payload, toppedUp ? 3 : 0);
  }, [draftId, searchParams]);

  // Keep the narration feed scrolled to the latest line.
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [lines]);

  async function run(payload: unknown, retriesLeft: number) {
    setPhase('streaming');
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 402) {
        // Post-checkout webhook lag: the Stripe redirect fires before the
        // webhook always. Retry with backoff; if still 402 after the retries,
        // re-show the upsell modal (something went wrong with the purchase).
        if (retriesLeft > 0) {
          setLines((prev) => [
            ...prev,
            { type: 'system', line: `› Credits syncing from payment… retrying (${retriesLeft} left)` },
          ]);
          await new Promise((r) => setTimeout(r, 2500));
          return run(payload, retriesLeft - 1);
        }
        setPhase('out-of-credits');
        return;
      }
      if (!res.ok || !res.body) {
        throw new Error(`Engine returned ${res.status}`);
      }

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
            const evt = JSON.parse(json) as NarrationEvent;
            setLines((prev) => [...prev, evt]);

            if (evt.type === 'result') {
              const r = await fetch(`/api/rewrite-meta/${evt.id}`);
              if (r.ok) {
                const meta = (await r.json()) as ResultHeader;
                setHeader(meta);
              }
              setPhase('done');
            }
            if (evt.type === 'error') {
              setError(evt.message);
              setPhase('error');
            }
          } catch {
            /* skip malformed event */
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  }

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-10">
      {phase !== 'done' && (
        <>
          <span className="badge badge-purple mb-4">Live engine narration</span>
          <h1 className="display-large mb-3">Analysing your CV against the role…</h1>
          <p className="body-large mb-8 max-w-[640px]">
            Six passes — job analysis, CV analysis, role match score, recruiter verdict, rewritten CV + cover letter, ATS confidence rating. Watch it think.
          </p>
        </>
      )}

      {phase === 'done' && header && (
        <ResultHeaderBlock header={header} />
      )}

      <div ref={feedRef} className="feed mb-8 max-h-[44vh] overflow-y-auto">
        {lines.length === 0 && phase === 'priming' && (
          <div className="feed-line system">› Booting…</div>
        )}
        {lines.map((l, i) => {
          const cls =
            l.type === 'system'
              ? 'feed-line system'
              : l.type === 'pass-complete'
                ? 'feed-line ok'
                : l.type === 'warn'
                  ? 'feed-line warn'
                  : l.type === 'pass'
                    ? 'feed-line pass'
                    : l.type === 'error'
                      ? 'feed-line warn'
                      : 'feed-line system';
          const text =
            l.type === 'error'
              ? `✗ ${l.message}`
              : l.type === 'result'
                ? '✓ Persisted.'
                : l.line;
          return (
            <div key={i} className={cls}>
              {text}
            </div>
          );
        })}
      </div>

      {phase === 'done' && header && <ResultView rewriteId={draftIdToRewriteId(lines)} />}

      {phase === 'error' && (
        <div className="card p-6" style={{ borderColor: 'rgba(234,34,97,0.4)' }}>
          <h3 className="sub-heading mb-2" style={{ color: 'var(--color-heading)' }}>
            Something went wrong
          </h3>
          <p className="body mb-4">{error}</p>
          <Link href="/" className="btn btn-sm btn-neutral">
            Back to start
          </Link>
        </div>
      )}

      {phase === 'out-of-credits' && (
        <UpsellModal resumeDraftId={draftId} onClose={() => location.assign('/dashboard')} />
      )}
    </div>
  );
}

/** Recover the real rewriteId from the narration 'result' event. */
function draftIdToRewriteId(lines: NarrationEvent[]): string {
  const evt = lines.find((l) => l.type === 'result');
  return evt && evt.type === 'result' ? evt.id : '';
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

      {/* 4 + 5. Rewritten CV download (covers both screen preview + PDF) */}
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
          <p className="caption">How well your CV aligns with this role’s stated requirements.</p>
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
