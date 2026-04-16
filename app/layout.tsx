import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { RefTracker } from '@/components/RefTracker';
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import './globals.css';

// Inter @ weights 300/400 mirrors the sohne-var weight 300 signature from
// DESIGN.md — never bold for headlines on funnel pages.
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-inter',
  display: 'swap',
});

// JetBrains Mono stands in for SourceCodePro — same monospace role.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ToolyKit — AI CV Rewriter | Beat the ATS in 60 seconds',
  description:
    'Got a CV? Tailor it to any job in 60 seconds. AI rewrites your CV against the actual job description — keyword-matched, recruiter-ready, ATS-optimised.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'ToolyKit — AI CV Rewriter | Beat the ATS in 60 seconds',
    description:
      'A four-pass AI pipeline that rewrites your CV against the exact job description. ATS-scored. No hallucinated experience.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ToolyKit — AI CV Rewriter',
    description:
      'A CV rewrite that is measurably better than generic AI tools, with an ATS score for the exact role you\u2019re applying to.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en-GB" className={`${inter.variable} ${mono.variable}`}>
        <body>
          <Suspense fallback={null}>
            <RefTracker />
          </Suspense>
          <Navbar />
          {children}
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
