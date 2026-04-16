import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { RewriteForm } from '@/components/RewriteForm';

export default async function HomePage() {
  const { userId } = await auth();

  // Real proof points only — per CLAUDE.md hard rule, NEVER fabricate stats
  // or social proof. These are facts about the engine + pricing, not invented
  // user counts or fake company logos.
  const proofPoints = [
    { label: 'Free first rewrite', sub: 'no card up front' },
    { label: '+ 1 free every month', sub: 'auto-resets on the 1st' },
    { label: '4-pass AI pipeline', sub: 'not a single prompt' },
    { label: 'Zero invented experience', sub: 'gaps flagged honestly' },
  ];

  const howItWorks = [
    {
      n: '01',
      title: 'Reads the JD',
      body: 'Pass 1 extracts the required + preferred skills, the deal-breakers, and the company tone — without inferring anything that isn’t written.',
    },
    {
      n: '02',
      title: 'Reads your CV',
      body: 'Pass 2 maps your roles, achievements (with vs without metrics), and your voice — formal or casual, first-person or third — so the rewrite preserves it.',
    },
    {
      n: '03',
      title: 'Rewrites against the JD',
      body: 'Pass 3 re-angles your real experience to surface the JD’s keywords. Streamed live so you watch it think. Records every change with a one-line reason.',
    },
    {
      n: '04',
      title: 'Scores it honestly',
      body: 'Pass 4 produces a defensible match score against the exact role, with a gap report calling out what the JD wants but your CV legitimately doesn’t have.',
    },
  ];

  const features = [
    {
      title: 'Multi-pass pipeline',
      body: 'Four separate AI passes feed each other. A single generic prompt can’t reason this way.',
    },
    {
      title: 'No hallucinated experience',
      body: 'Defensive prompts repeated three ways. If the JD asks for AWS and your CV doesn’t have it, the gap report says so — we don’t fake it.',
    },
    {
      title: 'Voice preserved',
      body: 'We rewrite around your real language. No flattening into generic LinkedIn-corporate tone.',
    },
    {
      title: 'Three PDF templates',
      body: 'ATS-clean (recommended), Professional, Modern. Re-download in any format from your dashboard.',
    },
    {
      title: 'Cover letter included',
      body: 'Every rewrite ships with a tight, voice-matched cover letter built around the same JD analysis. Copy or download as PDF.',
    },
  ];

  return (
    <main>
      {/* ── Nav ─────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-[var(--color-border)]">
        <div className="max-w-[1080px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-[15px] font-medium tracking-tight" style={{ color: 'var(--color-heading)' }}>
            <span style={{ color: 'var(--color-purple)' }}>ATS</span>
            <span style={{ color: 'var(--color-heading)' }}>·</span>
            rewriter
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="#how" className="hidden sm:inline px-3 py-2" style={{ color: 'var(--color-heading)' }}>
              How it works
            </Link>
            <Link href="#pricing" className="hidden sm:inline px-3 py-2" style={{ color: 'var(--color-heading)' }}>
              Pricing
            </Link>
            {userId ? (
              <Link href="/dashboard" className="btn btn-sm btn-neutral">Dashboard</Link>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm px-3 py-2" style={{ color: 'var(--color-heading)' }}>
                  Sign in
                </Link>
                <Link href="/sign-in" className="btn btn-sm btn-primary">Start free</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[420px] -z-10 opacity-[0.06] blur-3xl"
          style={{ background: 'radial-gradient(60% 60% at 50% 0%, #533afd 0%, transparent 70%)' }}
        />
        <div className="max-w-[1080px] mx-auto px-6 pt-20 pb-14">
          <div className="max-w-[760px] mx-auto text-center">
            <span className="badge badge-purple mb-6">Four-pass AI · streamed live</span>
            <h1 className="display-hero mb-6">
              Your CV is written for humans.<br />
              <span style={{ color: 'var(--color-body)' }}>Recruiters aren’t reading it.</span>
            </h1>
            <p className="body-large mb-8 max-w-[620px] mx-auto">
              Paste your CV, paste the job description. In about 90 seconds you get a version
              rewritten to pass the ATS — scored against the exact role, with{' '}
              <span style={{ color: 'var(--color-heading)' }}>no invented experience</span>.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href={userId ? '#form' : '/sign-in'} className="btn btn-lg btn-primary">
                Start free →
              </Link>
              <Link href="#how" className="btn btn-lg btn-ghost">
                See how it works
              </Link>
            </div>
          </div>

          {/* Proof row — real facts, no fabrications. */}
          <div className="mt-14 max-w-[920px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--color-border)] rounded-lg overflow-hidden border border-[var(--color-border)]">
            {proofPoints.map((p) => (
              <div key={p.label} className="bg-white px-5 py-5">
                <div className="text-[15px] tabular" style={{ color: 'var(--color-heading)', fontWeight: 400 }}>
                  {p.label}
                </div>
                <div className="caption mt-1">{p.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Form ────────────────────────────────────── */}
      <section id="form" className="max-w-[760px] mx-auto px-6 pb-24">
        <RewriteForm signedIn={!!userId} />
      </section>

      {/* ── How it works (4 passes) ─────────────────── */}
      <section id="how" className="bg-[var(--color-surface-soft)] border-y border-[var(--color-border)]">
        <div className="max-w-[1080px] mx-auto px-6 py-20">
          <div className="max-w-[680px] mb-14">
            <span className="badge badge-purple mb-4">How it works</span>
            <h2 className="section-heading mb-4">Four passes, not one prompt.</h2>
            <p className="body-large">
              Each pass is independent and each one feeds the next. That’s the structural reason
              the output is measurably different from a generic AI rewrite — and why we can
              scaffold an honest before/after score.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {howItWorks.map((step) => (
              <div key={step.n} className="card-elevated p-7">
                <div className="font-mono text-xs mb-3" style={{ color: 'var(--color-purple)' }}>
                  PASS {step.n}
                </div>
                <h3 className="sub-heading mb-2">{step.title}</h3>
                <p className="body">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ────────────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 py-20">
        <div className="max-w-[680px] mb-14">
          <span className="badge badge-purple mb-4">Why this is different</span>
          <h2 className="section-heading mb-4">Four guarantees a generic AI tool can’t make.</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {features.map((f) => (
            <div key={f.title} className="card p-7">
              <h3 className="sub-heading mb-2">{f.title}</h3>
              <p className="body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing (dark Stripe-brand section) ─────── */}
      <section id="pricing" className="bg-[var(--color-surface-dark)] text-white">
        <div className="max-w-[1080px] mx-auto px-6 py-20">
          <div className="max-w-[680px] mb-12">
            <span className="badge mb-4" style={{ background: 'rgba(255,255,255,0.08)', color: '#b9b9f9', borderColor: 'rgba(255,255,255,0.12)' }}>
              Pricing
            </span>
            <h2 className="section-heading mb-4" style={{ color: 'white' }}>
              Start free. Top up only when you need to.
            </h2>
            <p className="body-large" style={{ color: 'var(--color-fg-on-dark-muted)' }}>
              Your first rewrite is free. Then you get one free rewrite every calendar month.
              Beyond that, top up — credits never expire.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <PriceCard tier="Free" big="£0" sub="first rewrite + 1 / month" cta="Start free" href={userId ? '#form' : '/sign-in'} />
            <PriceCard tier="3-pack" big="£9.99" sub="3 rewrites · £3.33 each" cta="Top up" href="/dashboard" />
            <PriceCard tier="10-pack" big="£19.99" sub="10 rewrites · £2.00 each" cta="Best value" href="/dashboard" highlight />
          </div>
          <p className="caption mt-6" style={{ color: 'var(--color-fg-on-dark-muted)' }}>
            Multi-currency: GBP · USD · EUR · AUD · CAD · NZD. Secure payment via Stripe. No subscription.
          </p>
        </div>
      </section>

      <footer className="border-t border-[var(--color-border)]">
        <div className="max-w-[1080px] mx-auto px-6 py-10 caption flex items-center justify-between">
          <span>Part of the Almost Legal portfolio.</span>
          <span className="font-mono">ats-rewriter</span>
        </div>
      </footer>
    </main>
  );
}

function PriceCard({
  tier,
  big,
  sub,
  cta,
  href,
  highlight,
}: {
  tier: string;
  big: string;
  sub: string;
  cta: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-6 flex flex-col"
      style={{
        background: highlight ? 'rgba(83,58,253,0.18)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${highlight ? '#665efd' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <div className="text-xs uppercase tracking-[0.14em] mb-3" style={{ color: '#b9b9f9' }}>
        {tier}
      </div>
      <div className="tabular mb-1" style={{ fontSize: '2rem', fontWeight: 300, letterSpacing: '-0.02em', color: 'white' }}>
        {big}
      </div>
      <div className="text-sm mb-6" style={{ color: 'var(--color-fg-on-dark-muted)' }}>
        {sub}
      </div>
      <Link
        href={href}
        className="btn btn-sm mt-auto"
        style={{
          background: highlight ? 'var(--color-purple)' : 'transparent',
          color: highlight ? 'white' : '#b9b9f9',
          border: highlight ? '1px solid var(--color-purple)' : '1px solid rgba(255,255,255,0.18)',
        }}
      >
        {cta} →
      </Link>
    </div>
  );
}
