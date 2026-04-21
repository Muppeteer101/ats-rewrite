import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { HomeFaq } from '@/components/HomeFaq';
import { RewriteForm } from '@/components/RewriteForm';

export const metadata = {
  title: 'ToolyKit — AI CV Rewriter | Beat the ATS in 60 seconds',
  description:
    'Got a CV? Tailor it to any job in 60 seconds. AI rewrites your CV against the actual job description — keyword-matched, recruiter-ready, ATS-optimised.',
};

export default async function HomePage() {
  const { userId } = await auth();

  // Signed-in users scroll to the form. Signed-out users go to /sign-in
  // (RewriteForm also handles this redirect when signedIn=false).
  const primaryHref = userId ? '#start' : '/sign-in';

  return (
    <main className="tile-grid">
      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="tile tile-full tile-dark tile-hero">
        <div className="tile-content">
          <div className="tile-badge">
            <span className="tile-badge-stars">★★★★★</span>
            6-pass AI engine · streamed live
          </div>
          <h1 className="tile-h-mega">
            Your CV vs the ATS.<br />
            <span className="tile-h-gradient">Win the bot fight.</span>
          </h1>
          <p className="tile-sub">
            AI rewrites your CV against the actual job description —<br />
            keyword-matched, recruiter-ready, ATS-optimised.
          </p>
          <div className="cta-pair">
            <Link href={primaryHref} className="cta-fill">
              Rewrite My CV Free →
            </Link>
            <Link href="#how" className="cta-outline-tile">
              How it works
            </Link>
          </div>
          <p className="tile-meta">
            First rewrite free · 1 free per month · Pay-as-you-go from £2/rewrite
          </p>
        </div>
      </section>

      {/* ── FORM ───────────────────────────────────────────────── */}
      <section className="tile tile-full tile-light" id="start">
        <div className="tile-content" style={{ maxWidth: 760 }}>
          <h2 className="tile-h-section">Start your rewrite.</h2>
          <p className="tile-sub" style={{ marginBottom: 32 }}>
            Paste the job description and your CV — the engine does the rest.
          </p>
          <RewriteForm signedIn={!!userId} />
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section className="tile tile-full tile-light" id="how">
        <div className="tile-content">
          <h2 className="tile-h-section">Three steps. Sixty seconds.</h2>
          <p className="tile-sub">
            Paste the job description. Upload your CV. Download a CV that actually passes the bots.
          </p>
          <div className="tile-steps">
            <div className="tile-step">
              <div className="tile-step-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="6" y="6" width="36" height="36" rx="4" />
                  <path d="M14 16h20" /><path d="M14 24h20" /><path d="M14 32h12" />
                </svg>
              </div>
              <h3>1. Paste &amp; upload</h3>
              <p>Drop the job description in. Upload your CV (PDF or paste text). Takes 10 seconds.</p>
            </div>
            <div className="tile-step">
              <div className="tile-step-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="24" cy="24" r="14" />
                  <path d="M24 16v8l5 3" />
                  <path d="M8 24h4" /><path d="M36 24h4" />
                  <path d="M24 8v4" /><path d="M24 36v4" />
                </svg>
              </div>
              <h3>2. AI does its thing</h3>
              <p>Six passes. JD analysis, CV analysis, role match score, recruiter verdict, rewritten CV + cover letter, ATS confidence rating.</p>
            </div>
            <div className="tile-step">
              <div className="tile-step-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 6h18l8 8v28a2 2 0 01-2 2H12a2 2 0 01-2-2V8a2 2 0 012-2z" />
                  <path d="M30 6v8h8" />
                  <path d="M16 30h16" /><path d="M16 36h10" />
                  <circle cx="34" cy="34" r="6" fill="var(--accent)" stroke="none" />
                  <path d="M31 34l2 2 4-4" stroke="#fff" strokeWidth="2.5" />
                </svg>
              </div>
              <h3>3. Download your PDF</h3>
              <p>ATS-clean, Professional, or Modern template, plus a matching cover letter. Send and apply.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <section className="tile tile-half tile-dark">
        <div className="tile-content">
          <p className="tile-h-stat">6-pass</p>
          <h3 className="tile-h-sm">AI analysis engine</h3>
          <p className="tile-sub-sm">Reads the JD. Reads your CV. Scores the match. Runs a recruiter verdict. Rewrites the CV + drafts a cover letter. Confidence-rates it against ATS.</p>
        </div>
      </section>
      <section className="tile tile-half tile-dark">
        <div className="tile-content">
          <p className="tile-h-stat">4</p>
          <h3 className="tile-h-sm">PDF templates</h3>
          <p className="tile-sub-sm">ATS-Clean, Professional, Modern — plus a voice-matched cover letter built from the same JD analysis, always included.</p>
        </div>
      </section>

      {/* ── REVIEWS ────────────────────────────────────────────── */}
      <section className="tile tile-half tile-light tile-review">
        <div className="tile-content" style={{ textAlign: 'left' }}>
          <p className="tile-stars">★★★★★</p>
          <p className="tile-quote">
            &ldquo;ATS rejected me 12 times for the same job. ToolyKit rewrote my CV against the JD,
            scored it 94/100. <strong>Got the interview.</strong>&rdquo;
          </p>
          <p className="tile-cite">Sarah M., London</p>
        </div>
      </section>
      <section className="tile tile-half tile-light tile-review">
        <div className="tile-content" style={{ textAlign: 'left' }}>
          <p className="tile-stars">★★★★★</p>
          <p className="tile-quote">
            &ldquo;Senior dev role, 8 years experience, kept getting filtered out. The rewrite added the
            keywords I&rsquo;d been missing. <strong>Hired in 3 weeks.</strong>&rdquo;
          </p>
          <p className="tile-cite">James T., Manchester</p>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────── */}
      <section className="tile tile-full tile-light" id="pricing">
        <div className="tile-content" style={{ maxWidth: 760 }}>
          <h2 className="tile-h-section">Pay-as-you-go. No subscription.</h2>
          <p className="tile-sub">
            First rewrite is free. You get one free rewrite every calendar month. Top up only when you need more — credits never expire.
          </p>
          <div className="tile-price-grid">
            <div className="tile-price-card">
              <div className="tile-price-tier">Free</div>
              <div className="tile-price-big">£0</div>
              <div className="tile-price-sub">first rewrite + 1 / month</div>
              <div className="tile-price-each">No card required</div>
            </div>
            <div className="tile-price-card">
              <div className="tile-price-tier">3-pack</div>
              <div className="tile-price-big">£9.99</div>
              <div className="tile-price-sub">3 rewrites</div>
              <div className="tile-price-each">£3.33 each</div>
            </div>
            <div className="tile-price-card highlight">
              <div className="tile-price-tier">10-pack · best value</div>
              <div className="tile-price-big">£19.99</div>
              <div className="tile-price-sub">10 rewrites</div>
              <div className="tile-price-each">£2.00 each</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#86868b', marginBottom: 28 }}>
            Multi-currency: <strong style={{ color: '#1d1d1f' }}>£ · $ · € · A$ · C$ · NZ$</strong>.
            Secure payment via Stripe.
          </p>
          <div className="cta-pair">
            <Link href={primaryHref} className="cta-fill">
              Start Free →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section className="tile tile-full tile-light" id="faq" style={{ minHeight: 'auto', padding: '60px 40px' }}>
        <div className="tile-content" style={{ maxWidth: 720 }}>
          <h2 className="tile-h-section" style={{ marginBottom: 32 }}>Straight answers.</h2>
          <HomeFaq />
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="tile tile-full tile-dark tile-hero">
        <div className="tile-content">
          <h2 className="tile-h-mega">Win the bot fight.</h2>
          <p className="tile-sub">
            First rewrite free. 60 seconds. No subscription.
          </p>
          <div className="cta-pair">
            <Link href={primaryHref} className="cta-fill" style={{ padding: '16px 40px', fontSize: 18 }}>
              Rewrite My CV Free →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
