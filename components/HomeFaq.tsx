'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function HomeFaq() {
  const t = useTranslations('faq');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const FAQ_ITEMS = [
    { q: t('q1'), a: t('a1') },
    { q: t('q2'), a: t('a2') },
    { q: t('q3'), a: t('a3') },
    { q: t('q4'), a: t('a4') },
    { q: t('q5'), a: t('a5') },
    { q: t('q6'), a: t('a6') },
  ];

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
