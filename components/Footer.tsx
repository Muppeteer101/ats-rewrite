import Link from 'next/link';

/**
 * Canonical Almost Legal site-footer — mirrors cancelmyparkingticket /
 * fightmyfines pattern. Includes the Muerto Limited (Isle of Man)
 * corporate disclosure required across the portfolio.
 *
 * Sister-site list ordered as per the AL portfolio footer; ToolyKit
 * itself is omitted (we're on it).
 */
const SISTER_SITES = [
  { name: 'Cancel My Parking Ticket', url: 'https://cancelmyparkingticket.com' },
  { name: 'Appeal My Parking Ticket', url: 'https://appealmyparkingticket.com' },
  { name: 'Cancel My Citation', url: 'https://cancelmycitation.com' },
  { name: 'Appeal My Citation', url: 'https://appealmycitation.com' },
  { name: 'FightFines', url: 'https://fightfines.com' },
  { name: 'FightMyFines', url: 'https://fightmyfines.com' },
  { name: 'Car Damage Advisor', url: 'https://cardamageadvisor.com' },
  { name: 'WTF Did I Just Sign?', url: 'https://wtfdidijustsign.com' },
  { name: 'WTF Did I Just Agree?', url: 'https://wtfdidijustagree.com' },
  { name: 'Write My Legal Letter', url: 'https://writemylegalletter.com' },
  { name: 'EasyBusiness 365', url: 'https://easybusiness365.com' },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          <strong>ToolyKit.ai</strong> &mdash; AI CV rewriter that beats the ATS. Not a recruitment agency.
          AI-generated content should be reviewed before use.
        </p>
        <p style={{ marginTop: 8 }}>
          A brand of{' '}
          <a href="https://almostlegal.ai" target="_blank" rel="noopener">
            <strong>Almost Legal Limited</strong>
          </a>{' '}
          &mdash; a <strong>Muerto Limited (Isle of Man)</strong> company.
          &copy; 2026 Almost Legal.
        </p>
        <p style={{ marginTop: 8 }}>
          Powered by{' '}
          <a href="https://www.anthropic.com" target="_blank" rel="noopener">
            Claude AI
          </a>{' '}
          &mdash; choosing people over power.
        </p>

        <div className="site-footer-links">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/#faq">FAQ</Link>
          <a href="https://almostlegal.ai/terms" target="_blank" rel="noopener">Terms</a>
          <a href="https://almostlegal.ai/privacy" target="_blank" rel="noopener">Privacy</a>
          <a href="https://almostlegal.ai/cookies" target="_blank" rel="noopener">Cookies</a>
          <a href="mailto:hello@almostlegal.ai">Contact</a>
        </div>

        <div className="site-footer-brands">
          {SISTER_SITES.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener">
              {s.name}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
