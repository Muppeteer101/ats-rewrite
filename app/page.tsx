import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { RewriteForm } from '@/components/RewriteForm';

export default async function HomePage() {
  const { userId } = await auth();

  const features = [
    {
      title: 'Multi-pass pipeline',
      body:
        'JD analysis → CV analysis → contextual rewrite → ATS scoring. Each pass feeds the next. A single ChatGPT prompt can’t do this.',
    },
    {
      title: 'Real ATS score',
      body:
        'Every rewrite ends with a defensible match score against the exact role, with explicit gap callouts.',
    },
    {
      title: 'No hallucinated experience',
      body:
        'We prompt defensively. If the JD asks for AWS and your CV doesn’t have it, the gap report says so — we don’t fake it.',
    },
    {
      title: 'Voice preserved',
      body:
        'We rewrite around your real language. No flattening everyone into LinkedIn-corporate-7.',
    },
  ];

  return (
    <main className="min-h-screen">
      <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="font-mono text-sm tracking-wider">
          <span className="text-[var(--color-accent)]">ats</span>-rewriter
        </Link>
        <div className="flex items-center gap-5 text-sm">
          {userId ? (
            <Link href="/dashboard" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
              Dashboard
            </Link>
          ) : (
            <Link href="/sign-in" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
              Sign in
            </Link>
          )}
        </div>
      </nav>

      <section className="max-w-3xl mx-auto px-6 pt-12 pb-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-accent)] mb-5">
          A four-pass AI pipeline. Not a ChatGPT wrapper.
        </p>
        <h1 className="text-4xl md:text-5xl font-bold leading-[1.1] mb-6 tracking-tight">
          Your CV is written for humans.
          <br />
          <span className="text-[var(--color-fg-muted)]">Recruiters aren’t reading it.</span>
        </h1>
        <p className="text-lg text-[var(--color-fg-muted)] max-w-2xl mx-auto">
          Paste your CV. Paste the job description. In about 90 seconds you get a version rewritten
          to pass the ATS — scored against the exact role, with{' '}
          <strong className="text-[var(--color-fg)]">no invented experience</strong>.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 mb-10 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        {[
          { v: 'Free', l: 'first rewrite' },
          { v: '+1', l: 'free every month' },
          { v: '4×', l: 'pass pipeline' },
          { v: '0', l: 'invented experience' },
        ].map((b) => (
          <div key={b.l} className="card p-4">
            <div className="text-2xl font-bold text-[var(--color-accent)]">{b.v}</div>
            <div className="text-xs text-[var(--color-fg-muted)] mt-1">{b.l}</div>
          </div>
        ))}
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-20">
        <RewriteForm signedIn={!!userId} />
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24 grid md:grid-cols-2 gap-5">
        {features.map((c) => (
          <div key={c.title} className="card p-6">
            <h3 className="text-base font-semibold mb-2">{c.title}</h3>
            <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">{c.body}</p>
          </div>
        ))}
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-10 border-t border-[var(--color-border)] text-xs text-[var(--color-fg-dim)]">
        Part of the Almost Legal portfolio · ats-rewriter
      </footer>
    </main>
  );
}
