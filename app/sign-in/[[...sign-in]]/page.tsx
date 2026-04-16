import { SignIn } from '@clerk/nextjs';

export const metadata = {
  title: 'Sign in — ATS Rewriter',
};

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <SignIn
        appearance={{
          elements: {
            card: 'bg-[var(--color-surface)] border border-[var(--color-border)]',
          },
        }}
      />
    </main>
  );
}
