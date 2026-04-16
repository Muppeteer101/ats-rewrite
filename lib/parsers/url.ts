import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

/**
 * Fetch a job-posting URL and extract its main article text. Uses Mozilla
 * Readability — the same engine Firefox Reader View uses — which works well
 * on the majority of job boards (LinkedIn, Indeed, Greenhouse, Lever,
 * Workday, company career pages).
 *
 * Failures are intentionally turned into a clear-error so the UI can fall
 * back to "paste the JD instead" — never block the user on flaky scraping.
 */
export async function parseUrl(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('URL must start with http:// or https://');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      // Some boards (LinkedIn) return tiny pages to default UAs but real ones
      // to a browser-shaped UA. We send a generic-but-honest one.
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ATSRewriterBot/1.0; +https://ats-rewriter.com)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      // 10s — anything slower is probably bot-blocked anyway.
      signal: AbortSignal.timeout(10_000),
      redirect: 'follow',
    });
  } catch (e) {
    throw new Error(
      `Couldn't fetch that URL (${(e as Error).message}). Paste the job description instead and we'll keep going.`,
    );
  }

  if (!res.ok) {
    throw new Error(
      `That URL returned ${res.status}. Some sites (LinkedIn, Indeed) block automated fetches — paste the JD text and we'll keep going.`,
    );
  }

  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent || article.textContent.trim().length < 200) {
    throw new Error(
      "Couldn't extract a job description from that page (probably behind a login or paywall). Paste the text and we'll keep going.",
    );
  }

  return article.textContent
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
