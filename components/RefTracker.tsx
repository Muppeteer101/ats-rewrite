'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * RefTracker — captures `?ref=CODE` query param into a 30-day cookie + storage
 * for downstream creator-attribution, and pings the shared Almost Legal
 * track-click endpoint once per session per code.
 *
 * Lifted from /Users/openclaw/almostlegal-ai/components/RefCapture.tsx with
 * the cross-origin track-click URL and the brand identifier swapped to this
 * site. See /Users/openclaw/Documents/Muerto/creator-programme-handoff.md for
 * the full attribution flow.
 */
export function RefTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      const ref = searchParams.get('ref');
      if (!ref || !/^[A-Z0-9]{4,32}$/i.test(ref)) return;

      sessionStorage.setItem('refCode', ref);
      localStorage.setItem('al_ref', ref);
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `al_ref=${encodeURIComponent(ref)}; expires=${expires}; path=/; SameSite=Lax`;

      const sessionKey = `al_clicked_${ref}`;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');

      const brand = process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? 'improvemyresume.ai';
      const clickUrl =
        // CREATOR_CLICK_URL would normally come from server; we hardcode the
        // public almostlegal.ai endpoint here because it's the same value
        // across the whole portfolio and never rotated. Mirror this in
        // .env.example for clarity.
        'https://almostlegal.ai/api/track-click';

      fetch(clickUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: ref, brand }),
        keepalive: true,
        mode: 'cors',
      }).catch(() => {
        /* attribution failure must never break the page */
      });
    } catch {
      /* never break the page */
    }
  }, [searchParams]);

  return null;
}
