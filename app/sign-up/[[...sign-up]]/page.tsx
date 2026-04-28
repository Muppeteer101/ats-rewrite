import { SignUp } from '@clerk/nextjs';

export const metadata = {
  title: 'Sign up — ImproveMyResume.ai',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-surface-soft)]">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: '#533afd',
            colorText: '#061b31',
            colorTextSecondary: '#64748d',
            colorBackground: '#ffffff',
            colorInputBackground: '#ffffff',
            colorInputText: '#061b31',
            borderRadius: '4px',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          },
          elements: {
            card: 'shadow-none border border-[var(--color-border)]',
          },
        }}
      />
    </main>
  );
}
