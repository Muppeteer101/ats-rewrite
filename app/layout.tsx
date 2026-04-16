import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { RefTracker } from '@/components/RefTracker';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'ATS Rewriter — A CV rewrite that actually passes the bots',
  description:
    'Paste your CV, paste the job description. In 3 minutes you get a version rewritten to pass the ATS — scored against the exact role, with no invented experience.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'ATS Rewriter — A CV that actually passes the bots',
    description:
      'A four-pass AI pipeline that rewrites your CV against the exact job description. ATS-scored. No hallucinated experience.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ATS Rewriter',
    description:
      'A CV rewrite that is measurably better than ChatGPT and measurably cheaper than a human writer.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en-GB" className={`${inter.variable} ${mono.variable}`}>
        <body>
          {/* RefCapture/RefTracker reads ?ref=CODE → cookie + click ping.
              Wrapped in Suspense because it uses useSearchParams. */}
          <Suspense fallback={null}>
            <RefTracker />
          </Suspense>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
