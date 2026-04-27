import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { RewriteRunner } from '@/components/RewriteRunner';

export const dynamic = 'force-dynamic';

export default async function RewritePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="min-h-screen">
      <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/">
          <Image src="/logo.png" alt="ImproveMyResume.ai" width={180} height={54} priority style={{ objectFit: 'contain' }} />
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          Dashboard
        </Link>
      </nav>

      <Suspense fallback={<div className="max-w-3xl mx-auto px-6 py-10">Loading…</div>}>
        <RewriteRunner draftId={id} />
      </Suspense>
    </main>
  );
}
