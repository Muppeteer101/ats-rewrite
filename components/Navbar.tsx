'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useUser, useClerk } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from './LocaleSwitcher';

export function Navbar({ locale }: { locale: string }) {
  const { isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();
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
        {isLoaded && isSignedIn && <Link href="/dashboard">{t('dashboard')}</Link>}

        {isLoaded && isSignedIn ? (
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: '/' })}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--fg-muted)',
              font: 'inherit',
              cursor: 'pointer',
              padding: 0,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {t('signOut')}
          </button>
        ) : (
          <Link href="/sign-in" className="btn-coral btn-coral-sm">
            {t('signIn')}
          </Link>
        )}

        <LocaleSwitcher currentLocale={locale} />
      </div>
    </nav>
  );
}
