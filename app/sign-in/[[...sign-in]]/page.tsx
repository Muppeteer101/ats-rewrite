import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export const metadata = {
  title: 'Sign in — ATS Rewriter',
};

export default function Page() {
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="border-b border-[var(--color-border)]">
        <div className="max-w-[1080px] mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="text-[15px] font-medium tracking-tight" style={{ color: 'var(--color-heading)' }}>
            <span style={{ color: 'var(--color-purple)' }}>ATS</span>·rewriter
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6 bg-[var(--color-surface-soft)]">
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
      </div>
    </main>
  );
}
