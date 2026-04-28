'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

const LOCALES = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
];

export function LocaleSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const locale = e.target.value;
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => { router.refresh(); });
  }

  const current = LOCALES.find(l => l.code === currentLocale) ?? LOCALES[0];

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{
        position: 'absolute',
        left: 10,
        fontSize: 16,
        pointerEvents: 'none',
        lineHeight: 1,
      }}>
        {current.flag}
      </span>
      <select
        value={currentLocale}
        onChange={handleChange}
        disabled={isPending}
        aria-label="Select language"
        style={{
          appearance: 'none',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          color: 'var(--fg, #f4f0ff)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          opacity: isPending ? 0.6 : 1,
          paddingBottom: 6,
          paddingLeft: 32,
          paddingRight: 28,
          paddingTop: 6,
          transition: 'opacity 150ms',
        }}
      >
        {LOCALES.map(l => (
          <option key={l.code} value={l.code} style={{ color: '#0f0f1a', background: '#fff' }}>
            {l.label}
          </option>
        ))}
      </select>
      {/* chevron */}
      <span style={{
        position: 'absolute',
        right: 8,
        pointerEvents: 'none',
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
      }}>▼</span>
    </div>
  );
}
