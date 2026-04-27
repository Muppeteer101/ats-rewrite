import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Sign up — ImproveMyResume.ai',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="border-b border-[var(--color-border)]">
        <div className="max-w-[1080px] mx-auto px-6 h-16 flex items-center">
          <Link href="/">
            <Image src="/logo.png" alt="ImproveMyResume.ai" width={48} height={48} style={{ objectFit: 'contain' }} />
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6 bg-[var(--color-surface-soft)]">
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
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
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
