// Standard Almost Legal footer — mirrors cancelmyparkingticket /
// writemylegalletter / etc. Restyled to fit toolykit's Stripe-light theme.

import Link from 'next/link';

const SISTER_SITES = [
  { name: 'Cancel My Parking Ticket', url: 'https://cancelmyparkingticket.com' },
  { name: 'Cancel My Citation', url: 'https://cancelmycitation.com' },
  { name: 'Appeal My Parking Ticket', url: 'https://appealmyparkingticket.com' },
  { name: 'Appeal My Citation', url: 'https://appealmycitation.com' },
  { name: 'Fight My Fines', url: 'https://fightmyfines.com' },
  { name: 'Car Damage Advisor', url: 'https://www.cardamageadvisor.com' },
  { name: 'WTF Did I Just Agree?', url: 'https://wtfdidijustagree.com' },
  { name: 'WTF Did I Just Sign?', url: 'https://wtfdidijustsign.com' },
  { name: 'Write My Legal Letter', url: 'https://writemylegalletter.com' },
];

export function Footer() {
  return (
    <footer
      className="border-t"
      style={{
        background: 'var(--color-surface-soft)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="max-w-[1080px] mx-auto px-6 py-10 text-center">
        <p className="text-[13px] mb-2" style={{ color: 'var(--color-body)' }}>
          Powered by{' '}
          <a
            href="https://www.anthropic.com"
            target="_blank"
            rel="noopener"
            style={{ color: 'var(--color-purple)' }}
          >
            Claude AI
          </a>{' '}
          — choosing people over power.
        </p>

        <p
          className="text-[12px] leading-relaxed mb-3 max-w-2xl mx-auto"
          style={{ color: 'var(--color-body)' }}
        >
          &copy; 2026{' '}
          <a
            href="https://almostlegal.ai"
            target="_blank"
            rel="noopener"
            style={{ color: 'var(--color-heading)', fontWeight: 500 }}
          >
            Almost Legal Limited
          </a>
          . ATS Rewriter is an AI-assisted CV-writing tool, not a recruiter or career
          coach. Always review the output before submitting to an employer.
        </p>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] mb-5">
          <a
            href="https://almostlegal.ai/terms"
            target="_blank"
            rel="noopener"
            style={{ color: 'var(--color-body)' }}
          >
            Terms &amp; Conditions
          </a>
          <a
            href="https://almostlegal.ai/privacy"
            target="_blank"
            rel="noopener"
            style={{ color: 'var(--color-body)' }}
          >
            Privacy Policy
          </a>
          <a
            href="https://almostlegal.ai/cookies"
            target="_blank"
            rel="noopener"
            style={{ color: 'var(--color-body)' }}
          >
            Cookie Policy
          </a>
          <a href="mailto:hello@almostlegal.ai" style={{ color: 'var(--color-body)' }}>
            Contact
          </a>
        </div>

        <div
          className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-[11px]"
          style={{ color: 'var(--color-fg-dim)' }}
        >
          {SISTER_SITES.map((s, i) => (
            <span key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener"
                style={{ color: 'var(--color-fg-dim)' }}
              >
                {s.name}
              </a>
              {i < SISTER_SITES.length - 1 && <span className="mx-1">·</span>}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
