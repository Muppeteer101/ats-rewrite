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
    <main>
      <nav className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-[var(--color-border)]">
        <div className="max-w-[1080px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-[15px] font-medium tracking-tight" style={{ color: 'var(--color-heading)' }}>
            <span style={{ color: 'var(--color-purple)' }}>ATS</span>·rewriter
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/new" className="btn btn-sm btn-neutral">
              New rewrite
            </Link>
            <UserButton />
          </div>
        </div>
      </nav>

      <div className="max-w-[1080px] mx-auto px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
          <div>
            <span className="badge badge-purple mb-3">Dashboard</span>
            <h1 className="display-large">
              Welcome back{user?.firstName ? <>, <span style={{ color: 'var(--color-purple)' }}>{user.firstName}</span></> : ''}.
            </h1>
          </div>
          <Link href="/new" className="btn btn-lg btn-primary">
            New rewrite →
          </Link>
        </div>

        {justToppedUp && (
          <div
            className="p-4 mt-6 rounded-[6px] border"
            style={{
              background: 'var(--color-success-bg)',
              borderColor: 'var(--color-success-border)',
              color: 'var(--color-success-text)',
            }}
          >
            ✓ Top-up complete. Pack of {params.pack} added to your account.
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 mt-10 mb-12">
          <div className="card-elevated p-6">
            <div className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--color-body)' }}>
              Available
            </div>
            <div
              className="tabular mb-2"
              style={{ fontSize: '2.5rem', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--color-heading)' }}
            >
              {availableCount(state)}
            </div>
            <div className="caption">{creditSummary(state)}</div>
          </div>
          <div className="card-elevated p-6">
            <div className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--color-body)' }}>
              Monthly free
            </div>
            <div
              className="mb-2"
              style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--color-heading)' }}
            >
              {state.monthlyFreeUsed ? 'Used' : 'Available'}
            </div>
            <div className="caption">
              {state.monthlyFreeUsed ? `Resets ${nextResetDate()}` : 'One per calendar month, free'}
            </div>
          </div>
          <div className="card-elevated p-6">
            <div className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--color-body)' }}>
              Top up
            </div>
            <div className="caption mb-3">3 for £9.99 / 10 for £19.99</div>
            <DashboardActions />
          </div>
        </div>

        <h2 className="sub-heading mb-4">Your rewrites</h2>
        {rewrites.length === 0 ? (
          <div className="card-elevated p-10 text-center">
            <p className="body mb-5">No rewrites yet. Your first one is free.</p>
            <Link href="/new" className="btn btn-lg btn-primary">
              Start your first rewrite →
            </Link>
          </div>
        ) : (
          <div className="card-elevated divide-y divide-[var(--color-border)]">
            {rewrites.map((r) => (
              <Link
                key={r.id}
                href={`/rewrite/${r.id}`}
                className="flex items-center gap-4 p-4 hover:bg-[var(--color-surface-soft)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[15px]" style={{ color: 'var(--color-heading)', fontWeight: 400 }}>
                    {r.jobTitle}
                  </div>
                  <div className="caption mt-0.5">
                    {new Date(r.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · {r.pdfTemplate}
                  </div>
                </div>
                <div className="text-sm flex items-center gap-2">
                  <span className="tabular" style={{ color: 'var(--color-body)' }}>{r.scoreBefore}</span>
                  <span style={{ color: 'var(--color-border-soft-purple)' }}>→</span>
                  <span className="tabular" style={{ color: 'var(--color-success-text)', fontWeight: 400 }}>
                    {r.scoreAfter}
                  </span>
                </div>
                <a
                  href={`/api/pdf/${r.id}?template=${r.pdfTemplate}`}
                  className="caption hover:text-[var(--color-purple)] underline decoration-dotted"
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
