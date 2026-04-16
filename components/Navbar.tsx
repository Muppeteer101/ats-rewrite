'use client';

import Link from 'next/link';
import { useUser, useClerk } from '@clerk/nextjs';

/**
 * ToolyKit pill-nav — frosted glass strip, logo left, links + CTA right.
 * Mirrors cancelmyparkingticket.com / fightmyfines.com canonical pattern.
 *
 * No theme toggle: ToolyKit ships light-only (the funnel pages — /rewrite,
 * /dashboard, /sign-in — are tied to a white Stripe-light theme).
 */
export function Navbar() {
  const { isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();

  return (
    <nav className="pill-nav" aria-label="Primary">
      <Link href="/" className="pill-nav-logo">
        ToolyKit<span>.ai</span>
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
