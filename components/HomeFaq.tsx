'use client';

import { useState } from 'react';

/**
 * ImproveMyResume homepage FAQ — accordion. Mirrors the cancelmyparkingticket
 * pattern: faq-item / faq-trigger / faq-answer styled in globals.css.
 */
const FAQ_ITEMS = [
  {
    q: 'What\u2019s an ATS and why does it matter?',
    a: 'Applicant Tracking Systems are the bots that filter resumes before a human ever sees them. They look for specific keywords from the job description. If your resume doesn\u2019t match — even if you\u2019re perfect for the role — you get rejected automatically. The engine rewrites your resume against the actual job description so the bot lets it through.',
  },
  {
    q: 'How is this different from ChatGPT writing my resume?',
    a: 'A single ChatGPT prompt does one thing at a time. The engine runs six separate AI passes that feed each other: it analyses the job description, analyses your resume, scores the role match, produces a recruiter verdict, rewrites the resume with a tailored cover letter and a log of every change, then rates ATS confidence on the rewrite. That structural difference is why the output is measurably better — and why we can scaffold an honest match score and ATS rating.',
  },
  {
    q: 'Will it invent experience I don\u2019t have?',
    a: 'No. Defensive prompts repeated three ways. If the JD asks for AWS and your resume doesn\u2019t have it, the gap report flags it honestly — we don\u2019t fake skills. The rewrite re-angles your real experience to surface the keywords; it doesn\u2019t fabricate them.',
  },
  {
    q: 'How much does it cost?',
    a: 'Your first rewrite is free, plus one free rewrite every calendar month. Beyond that you can top up: 1 rewrite at £4.99, 3-pack at £9.99 (£3.33 per rewrite) or 10-pack at £25 (£2.50 per rewrite). No subscription. Credits never expire. Multi-currency: GBP, USD, EUR, AUD, CAD, NZD.',
  },
  {
    q: 'What output do I get?',
    a: 'A polished PDF in your choice of three templates — ATS-Clean (recommended for most roles), Professional, or Modern. Plus an optional voice-matched cover letter built from the same JD analysis. Re-download in any format from your dashboard.',
  },
  {
    q: 'How long does it take?',
    a: 'About 60–90 seconds end to end. Streamed live so you watch the engine think — every change in the rewrite gets a one-line reason recorded against it.',
  },
];

export function HomeFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div>
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="faq-item">
          <button
            className="faq-trigger"
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
          >
            <span>{item.q}</span>
            <span
              aria-hidden="true"
              style={{
                fontSize: 20,
                color: '#6e6e73',
                transition: 'transform 0.2s',
                transform: openIndex === i ? 'rotate(45deg)' : 'none',
                display: 'inline-block',
              }}
            >
              +
            </span>
          </button>
          {openIndex === i && <div className="faq-answer">{item.a}</div>}
        </div>
      ))}
    </div>
  );
}
