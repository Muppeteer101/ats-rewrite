import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { HomeFaq } from '@/components/HomeFaq';
import { RewriteForm } from '@/components/RewriteForm';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const t = await getTranslations();

  // Anonymous landing — the form runs the free analysis immediately. The
  // paywall only kicks in at finalize, where the user is bounced to AL.
  const primaryHref = '#start';

  return (
    <main className="tile-grid">
      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="tile tile-full tile-dark tile-hero">
        <div className="tile-content">
          <div className="tile-badge">
            <span className="tile-badge-stars">★★★★★</span>
            {t('hero.badge')}
          </div>
          <h1 className="tile-h-mega">
            {t('hero.headline1')}<br />
            <span className="tile-h-gradient">{t('hero.headline2')}</span>
          </h1>
          <p className="tile-sub">
            {t('hero.sub').split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </p>
          <div className="cta-pair">
            <Link href={primaryHref} className="cta-fill">
              {t('hero.ctaPrimary')}
            </Link>
            <Link href="#how" className="cta-outline-tile">
              {t('hero.ctaSecondary')}
            </Link>
          </div>
          <p className="tile-meta">{t('hero.meta')}</p>
        </div>
      </section>

      {/* ── FORM ───────────────────────────────────────────────── */}
      <section className="tile tile-full tile-light" id="start">
        <div className="tile-content" style={{ maxWidth: 760 }}>
          <h2 className="tile-h-section">{t('form.sectionTitle')}</h2>
          <p className="tile-sub" style={{ marginBottom: 32 }}>
            {t('form.sectionSub')}
          </p>
          <RewriteForm signedIn={true} />
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section className="tile tile-full tile-light" id="how">
        <div className="tile-content">
          <h2 className="tile-h-section">{t('how.title')}</h2>
          <p className="tile-sub">{t('how.sub')}</p>
          <div className="tile-steps">
            <div className="tile-step">
              <div className="tile-step-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="6" y="6" width="36" height="36" rx="4" />
                  <path d="M14 16h20" /><path d="M14 24h20" /><path d="M14 32h12" />
                </svg>
              </div>
              <h3>{t('how.step1Title')}</h3>
              <p>{t('how.step1Body')}</p>
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
              <h3>{t('how.step2Title')}</h3>
              <p>{t('how.step2Body')}</p>
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
              <h3>{t('how.step3Title')}</h3>
              <p>{t('how.step3Body')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <section className="tile tile-half tile-dark">
        <div className="tile-content">
          <p className="tile-h-stat">{t('stats.stat1')}</p>
          <h3 className="tile-h-sm">{t('stats.stat1Title')}</h3>
          <p className="tile-sub-sm">{t('stats.stat1Body')}</p>
        </div>
      </section>
      <section className="tile tile-half tile-dark">
        <div className="tile-content">
          <p className="tile-h-stat">{t('stats.stat2')}</p>
          <h3 className="tile-h-sm">{t('stats.stat2Title')}</h3>
          <p className="tile-sub-sm">{t('stats.stat2Body')}</p>
        </div>
      </section>

      {/* ── REVIEWS ────────────────────────────────────────────── */}
      <section className="tile tile-half tile-light tile-review">
        <div className="tile-content" style={{ textAlign: 'left' }}>
          <p className="tile-stars">★★★★★</p>
          <p className="tile-quote">{t('reviews.review1')}</p>
          <p className="tile-cite">{t('reviews.review1Cite')}</p>
        </div>
      </section>
      <section className="tile tile-half tile-light tile-review">
        <div className="tile-content" style={{ textAlign: 'left' }}>
          <p className="tile-stars">★★★★★</p>
          <p className="tile-quote">{t('reviews.review2')}</p>
          <p className="tile-cite">{t('reviews.review2Cite')}</p>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────── */}
      <section className="tile tile-full tile-light" id="pricing">
        <div className="tile-content" style={{ maxWidth: 760 }}>
          <h2 className="tile-h-section">{t('pricing.title')}<br />{t('pricing.titleLine2')}</h2>
          <p className="tile-sub">{t('pricing.sub')}</p>
          <div className="tile-price-grid">
            <div className="tile-price-card">
              <div className="tile-price-tier">{t('pricing.tierFree')}</div>
              <div className="tile-price-big">{t('pricing.priceFree')}</div>
              <div className="tile-price-sub">{t('pricing.subFree')}</div>
              <div className="tile-price-each">{t('pricing.eachFree')}</div>
            </div>
            <div className="tile-price-card">
              <div className="tile-price-tier">{t('pricing.tier1')}</div>
              <div className="tile-price-big">{t('pricing.price1')}</div>
              <div className="tile-price-sub">{t('pricing.sub1')}</div>
              <div className="tile-price-each">{t('pricing.each1')}</div>
            </div>
            <div className="tile-price-card">
              <div className="tile-price-tier">{t('pricing.tier3')}</div>
              <div className="tile-price-big">{t('pricing.price3')}</div>
              <div className="tile-price-sub">{t('pricing.sub3')}</div>
              <div className="tile-price-each">{t('pricing.each3')}</div>
            </div>
            <div className="tile-price-card highlight">
              <div className="tile-price-tier">{t('pricing.tier10')}</div>
              <div className="tile-price-big">{t('pricing.price10')}</div>
              <div className="tile-price-sub">{t('pricing.sub10')}</div>
              <div className="tile-price-each">{t('pricing.each10')}</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#86868b', marginBottom: 28 }}>
            {t('pricing.currency', { currencies: t('pricing.currencies') })}
          </p>
          <div className="cta-pair">
            <Link href={primaryHref} className="cta-fill">
              {t('pricing.ctaStart')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section className="tile tile-full tile-light" id="faq" style={{ minHeight: 'auto', padding: '60px 40px' }}>
        <div className="tile-content" style={{ maxWidth: 720 }}>
          <h2 className="tile-h-section" style={{ marginBottom: 32 }}>{t('faq.title')}</h2>
          <HomeFaq />
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="tile tile-full tile-dark tile-hero">
        <div className="tile-content">
          <h2 className="tile-h-mega">{t('finalCta.headline')}</h2>
          <p className="tile-sub">{t('finalCta.sub')}</p>
          <div className="cta-pair">
            <Link href={primaryHref} className="cta-fill" style={{ padding: '16px 40px', fontSize: 18 }}>
              {t('finalCta.btn')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
