'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useUser, useClerk } from '@clerk/nextjs';

export function Navbar() {
  const { isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();

  return (
    <nav className="pill-nav" aria-label="Primary">
      <Link href="/" className="pill-nav-logo">
        <Image src="/logo.svg" alt="ImproveMyResume.ai" width={220} height={28} priority />
      </Link>

      <div className="pill-nav-links">
        <Link href="/#how">How it works</Link>
        <Link href="/#pricing">Pricing</Link>
        <Link href="/#faq">FAQ</Link>
        {isLoaded && isSignedIn && <Link href="/dashboard">Dashboard</Link>}

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
            Sign out
          </button>
        ) : (
          <Link href="/sign-in" className="btn-coral btn-coral-sm">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
