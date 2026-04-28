import { SignIn } from '@clerk/nextjs';

export const metadata = {
  title: 'Sign in — ImproveMyResume.ai',
};

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-surface-soft)]">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/new"
        appearance={{
          variables: {
            colorPrimary: '#533afd',
            colorText: '#061b31',
            colorTextSecondary: '#64748d',
            colorBackground: '#ffffff',
            colorInputBackground: '#ffffff',
            colorInputText: '#061b31',
            borderRadius: '4px',
            fontFamily: 'var(--font-inter), sans-serif',
          },
          elements: {
            card: 'shadow-none border border-[var(--color-border)]',
          },
        }}
      />
    </main>
  );
}
