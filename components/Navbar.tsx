import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from './LocaleSwitcher';

/**
 * Auth lives entirely on almostlegal.ai. The "Sign in" link redirects there.
 * No client-side Clerk hooks here — IMR has no Clerk SDK.
 */
export function Navbar({ locale }: { locale: string }) {
  const t = useTranslations('nav');

  return (
    <nav className="pill-nav" aria-label="Primary">
      <Link href="/" className="pill-nav-logo">
        <Image src="/logo.png" alt="ImproveMyResume.ai" width={180} height={54} priority style={{ objectFit: 'contain' }} />
      </Link>

      <div className="pill-nav-links">
        <Link href="/#how">{t('howItWorks')}</Link>
        <Link href="/#pricing">{t('pricing')}</Link>
        <Link href="/#faq">{t('faq')}</Link>
        <Link href="https://almostlegal.ai/dashboard">{t('dashboard')}</Link>
        <Link href="https://almostlegal.ai/sign-in?redirect_url=https%3A%2F%2Fimprovemyresume.ai%2F" className="btn-coral btn-coral-sm">
          {t('signIn')}
        </Link>

        <LocaleSwitcher currentLocale={locale} />
      </div>
    </nav>
  );
}
