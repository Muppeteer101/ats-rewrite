import { RewriteForm } from '@/components/RewriteForm';

export const metadata = {
  title: 'New Rewrite — ImproveMyResume',
};

/**
 * Anonymous form. The free analyse + rescore stages run without an account.
 * The paid finalize step bounces the user to almostlegal.ai/spend.
 */
export default function NewRewritePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <span className="badge badge-purple mb-4 inline-block">New rewrite</span>
      <h1 className="display-large mb-3">Rewrite your resume</h1>
      <p className="body mb-8 max-w-[640px]">
        Paste the job description and your resume. The six-pass engine takes it from there.
      </p>
      <RewriteForm signedIn={true} />
    </main>
  );
}
