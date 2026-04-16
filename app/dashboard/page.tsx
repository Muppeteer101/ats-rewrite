import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import {
  getCreditState,
  listRewrites,
  availableCount,
  summary as creditSummary,
  nextResetDate,
} from '@/lib/credits';
import { DashboardActions } from '@/components/DashboardActions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string; pack?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await currentUser();
  const params = await searchParams;
  const justToppedUp = params.topup === 'success';

  const [state, rewrites] = await Promise.all([
    getCreditState(userId),
    listRewrites(userId, 50),
  ]);

  return (
    <main className="min-h-screen">
      <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="font-mono text-sm tracking-wider">
          <span className="text-[var(--color-accent)]">ats</span>-rewriter
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
            New rewrite
          </Link>
          <UserButton />
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-accent)] mb-2">
              Dashboard
            </p>
            <h1 className="text-3xl font-bold">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}.
            </h1>
          </div>
          <Link
            href="/"
            className="px-5 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-sm hover:opacity-90"
          >
            New rewrite →
          </Link>
        </div>

        {justToppedUp && (
          <div className="card p-4 mt-6 border-l-4 border-l-[var(--color-accent-2)]">
            <p className="text-sm">
              ✓ Top-up complete. Pack of {params.pack} added to your account.
            </p>
          </div>
        )}

        {/* Credits summary */}
        <div className="grid md:grid-cols-3 gap-4 mt-8 mb-10">
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wider text-[var(--color-fg-dim)] mb-2">
              Available
            </div>
            <div className="text-4xl font-bold text-[var(--color-accent)]">
              {availableCount(state)}
            </div>
            <div className="text-xs text-[var(--color-fg-muted)] mt-2">
              {creditSummary(state)}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wider text-[var(--color-fg-dim)] mb-2">
              Monthly free
            </div>
            <div className="text-2xl font-bold">
              {state.monthlyFreeUsed ? 'Used' : 'Available'}
            </div>
            <div className="text-xs text-[var(--color-fg-muted)] mt-2">
              {state.monthlyFreeUsed ? `Resets ${nextResetDate()}` : 'One per calendar month, free'}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wider text-[var(--color-fg-dim)] mb-2">
              Top up
            </div>
            <div className="text-sm text-[var(--color-fg-muted)] mb-3">
              3 for £9.99 / 10 for £19.99
            </div>
            <DashboardActions />
          </div>
        </div>

        {/* History */}
        <h2 className="text-lg font-semibold mb-4">Your rewrites</h2>
        {rewrites.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-[var(--color-fg-muted)] mb-4">
              No rewrites yet. Your first one is free.
            </p>
            <Link
              href="/"
              className="inline-block px-5 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-sm hover:opacity-90"
            >
              Start your first rewrite →
            </Link>
          </div>
        ) : (
          <div className="card divide-y divide-[var(--color-border)]">
            {rewrites.map((r) => (
              <Link
                key={r.id}
                href={`/rewrite/${r.id}`}
                className="flex items-center gap-4 p-4 hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.jobTitle}</div>
                  <div className="text-xs text-[var(--color-fg-muted)]">
                    {new Date(r.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · {r.pdfTemplate}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <span className="text-[var(--color-fg-muted)]">{r.scoreBefore}</span>
                  <span className="text-[var(--color-fg-dim)] mx-1">→</span>
                  <span className="text-[var(--color-accent-2)] font-semibold">{r.scoreAfter}</span>
                </div>
                <a
                  href={`/api/pdf/${r.id}?template=${r.pdfTemplate}`}
                  className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  PDF
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
