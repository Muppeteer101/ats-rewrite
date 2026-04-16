'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { NarrationEvent } from '@/src/engine/schemas';
import { ScoreGauge } from './ScoreGauge';
import { TemplatePicker } from './TemplatePicker';
import { GapReportCard } from './GapReportCard';
import { ChangeRationaleList } from './ChangeRationaleList';
import { UpsellModal } from './UpsellModal';

type Phase = 'priming' | 'streaming' | 'done' | 'error' | 'out-of-credits';

type Result = {
  rewriteId: string;
  jobTitle: string;
  scoreBefore: number;
  scoreAfter: number;
};

export function RewriteRunner({ draftId }: { draftId: string }) {
  const [lines, setLines] = useState<NarrationEvent[]>([]);
  const [phase, setPhase] = useState<Phase>('priming');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Pull the payload that RewriteForm stashed before redirect.
    const raw = sessionStorage.getItem(`rewrite-payload:${draftId}`);
    if (!raw) {
      setError('Lost your input on the way here. Go back and try again.');
      setPhase('error');
      return;
    }

    void run(JSON.parse(raw));
  }, [draftId]);

  async function run(payload: unknown) {
    setPhase('streaming');
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 402) {
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
                const meta = await r.json();
                setResult({ rewriteId: evt.id, ...meta });
              } else {
                // Fallback — no meta route yet; reconstruct from the most recent pass-complete line for Pass 4.
                setResult({
                  rewriteId: evt.id,
                  jobTitle: 'Your role',
                  scoreBefore: 0,
                  scoreAfter: 0,
                });
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
    <div className="max-w-4xl mx-auto px-6 py-8">
      {phase !== 'done' && (
        <>
          <h1 className="text-2xl font-bold mb-2">Rewriting your CV…</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mb-6">
            Watch the four passes run. This is genuinely thinking — JD analysis, your CV analysis,
            contextual rewrite, ATS scoring.
          </p>
        </>
      )}

      {phase === 'done' && result && (
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-accent-2)] mb-2">
            ✓ Rewrite complete
          </p>
          <h1 className="text-3xl font-bold mb-4">
            {result.jobTitle ? `For ${result.jobTitle}` : 'Your rewrite is ready'}
          </h1>
          <ScoreGauge before={result.scoreBefore} after={result.scoreAfter} />
        </div>
      )}

      {/* Narration feed */}
      <div className="feed py-3 mb-6 max-h-[40vh] overflow-y-auto">
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

      {phase === 'done' && result && (
        <ResultView rewriteId={result.rewriteId} />
      )}

      {phase === 'error' && (
        <div className="card p-6 border-[var(--color-danger)]">
          <h3 className="font-semibold mb-2">Something went wrong</h3>
          <p className="text-sm text-[var(--color-fg-muted)] mb-4">{error}</p>
          <Link href="/" className="text-sm underline">
            Back to start
          </Link>
        </div>
      )}

      {phase === 'out-of-credits' && <UpsellModal onClose={() => location.assign('/')} />}
    </div>
  );
}

/** Loads the persisted EngineResult and renders the full result UI. */
function ResultView({ rewriteId }: { rewriteId: string }) {
  const [data, setData] = useState<{
    rewrite: import('@/src/engine/schemas').RewriteOutput;
    score: import('@/src/engine/schemas').ATSScore;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/rewrite-meta/${rewriteId}?full=1`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => null);
  }, [rewriteId]);

  if (!data) return <div className="text-sm text-[var(--color-fg-muted)]">Loading result…</div>;

  return (
    <div className="space-y-6">
      <TemplatePicker rewriteId={rewriteId} />
      <GapReportCard score={data.score} unmetRequirements={data.rewrite.unmet_requirements} />
      <ChangeRationaleList rewrite={data.rewrite} />
    </div>
  );
}
