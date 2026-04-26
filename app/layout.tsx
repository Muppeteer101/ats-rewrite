import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import Script from 'next/script';
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
  title: 'ImproveMyResume — AI Resume Rewriter | Beat the ATS in 60 seconds',
  description:
    'Got a resume? Tailor it to any job in 60 seconds. AI rewrites your resume against the actual job description — keyword-matched, recruiter-ready, ATS-optimised.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'ImproveMyResume — AI Resume Rewriter | Beat the ATS in 60 seconds',
    description:
      'A six-pass AI pipeline that analyses, scores, rewrites, and ATS-checks your resume against the exact job description. Recruiter verdict included. No hallucinated experience.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ImproveMyResume — AI Resume Rewriter',
    description:
      'A resume rewrite that is measurably better than generic AI tools, with an ATS score for the exact role you\u2019re applying to.',
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
          {process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID && (
            <Script id="clarity" strategy="afterInteractive">{`
              (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID}");
            `}</Script>
          )}
        </body>
      </html>
    </ClerkProvider>
  );
}
