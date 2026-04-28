import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

const SISTER_SITES = [
  { name: 'Cancel My Parking Ticket', url: 'https://cancelmyparkingticket.com' },
  { name: 'Cancel My Citation', url: 'https://cancelmycitation.com' },
  { name: 'FightFines', url: 'https://fightfines.com' },
  { name: 'Car Damage Advisor', url: 'https://cardamageadvisor.com' },
  { name: 'WTF Did I Just Sign?', url: 'https://wtfdidijustsign.com' },
  { name: 'WTF Did I Just Agree?', url: 'https://wtfdidijustagree.com' },
  { name: 'Write My Legal Letter', url: 'https://writemylegalletter.com' },
  { name: 'EasyBusiness 365', url: 'https://easybusiness365.com' },
];

export async function Footer() {
  const t = await getTranslations('footer');

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          <strong>ImproveMyResume.ai</strong> &mdash; {t('tagline')}
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
          <a href="https://almostlegal.ai/terms" target="_blank" rel="noopener">{t('terms')}</a>
          <a href="https://almostlegal.ai/privacy" target="_blank" rel="noopener">{t('privacy')}</a>
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
