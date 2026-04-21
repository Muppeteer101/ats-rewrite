import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { RewriteForm } from '@/components/RewriteForm';

export const metadata = {
  title: 'New Rewrite — ToolyKit',
};

export default async function NewRewritePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <span className="badge badge-purple mb-4 inline-block">New rewrite</span>
      <h1 className="display-large mb-3">Rewrite your CV</h1>
      <p className="body mb-8 max-w-[640px]">
        Paste the job description and your CV. The six-pass engine takes it from there.
      </p>
      <RewriteForm signedIn={true} />
    </main>
  );
}
