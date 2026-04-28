import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const SUPPORTED = ['en', 'es', 'fr', 'de'] as const;
export type Locale = (typeof SUPPORTED)[number];

export function isValidLocale(l: string): l is Locale {
  return (SUPPORTED as readonly string[]).includes(l);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get('NEXT_LOCALE')?.value ?? 'en';
  const locale: Locale = isValidLocale(raw) ? raw : 'en';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
