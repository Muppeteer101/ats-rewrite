import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Domains known to block Vercel datacenter IPs — skip direct fetch, go straight to Jina
const BLOCKED_BOARDS = /linkedin\.com|indeed\.com/i;

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Section headings that signal the start of boilerplate — stop keeping from here.
const BOILERPLATE_HEADING = /^(benefits|perks|what we offer|what's in it for you|why join|why work (with|at|for)|compensation|pay range|salary|total rewards|the package|our (culture|values|story|mission|vision)|about (us|the company|our company|our team)|who we are|diversity|equal opportunity|eeo|affirmative action|notice to|privacy|cookie|candidate data|your data|recruitment fraud|apply now|how to apply|application (process|instructions)|next steps)\b/i;

// Section headings that signal content we WANT — once seen, keep until boilerplate heading.
const REQUIREMENTS_HEADING = /^(requirement|qualification|what you('ll| will) (bring|need|have)|what we('re| are) looking for|must.have|essential|responsibilities|what you('ll| will) do|the role|role overview|position overview|about the role|job description|key responsibilities|about the (job|position|opportunity)|your (responsibilities|role)|skills|experience|education|technical requirement|minimum requirement|preferred (qualification|experience)|key requirement)/i;

/**
 * Strip company boilerplate from a scraped job posting so only the
 * requirements/responsibilities/qualifications sections reach analyzeJD.
 *
 * Strategy: walk the text line-by-line, detect section headings, and drop any
 * section that starts with a known boilerplate pattern. We keep text until the
 * first boilerplate heading, then toggle back on if a requirements heading follows.
 */
export function stripJDBoilerplate(text: string): string {
  const lines = text.split('\n');
  const kept: string[] = [];
  let keeping = true; // start by keeping — opening paragraphs are usually the role summary

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headings: short lines (≤60 chars) that look like titles.
    if (trimmed.length > 0 && trimmed.length <= 60 && !/[.!?]$/.test(trimmed)) {
      if (BOILERPLATE_HEADING.test(trimmed)) {
        keeping = false;
        continue;
      }
      if (REQUIREMENTS_HEADING.test(trimmed)) {
        keeping = true;
      }
    }

    if (keeping) {
      kept.push(line);
    }
  }

  const stripped = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // Fallback: if we stripped too aggressively (< 200 chars left), return original.
  return stripped.length >= 200 ? stripped : text;
}

async function fetchDirect(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(10_000),
    redirect: 'follow',
  });

  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  }

  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article?.textContent || article.textContent.trim().length < 200) {
    throw new Error('insufficient content');
  }

  return stripJDBoilerplate(normalize(article.textContent));
}

// Jina AI Reader proxies through residential IPs and returns clean text.
// Free, no API key, handles LinkedIn and other bot-blocking boards.
async function fetchViaJina(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/plain,text/html,*/*',
      'X-Return-Format': 'text',
    },
    signal: AbortSignal.timeout(20_000),
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`Jina returned ${res.status}`);

  const text = await res.text();
  if (!text || text.trim().length < 200) throw new Error('Jina returned insufficient content');

  return stripJDBoilerplate(normalize(text));
}

/**
 * Fetch a job-posting URL and extract its main article text.
 *
 * Strategy:
 * 1. For known bot-blocking boards (LinkedIn, Indeed): go straight to Jina AI Reader.
 * 2. For all other URLs: try direct fetch first; fall back to Jina on 429/403.
 * 3. If everything fails, throw a user-friendly error guiding them to paste the JD.
 */
export async function parseUrl(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('URL must start with http:// or https://');
  }

  const isBlockedBoard = BLOCKED_BOARDS.test(url);

  if (!isBlockedBoard) {
    try {
      return await fetchDirect(url);
    } catch (err) {
      const status = (err as { status?: number }).status;
      // Only fall through to Jina for HTTP errors that indicate blocking
      if (status !== 429 && status !== 403 && status !== 401) {
        throw new Error(
          `Couldn't fetch that URL (${(err as Error).message}). Paste the job description instead and we'll keep going.`,
        );
      }
    }
  }

  try {
    return await fetchViaJina(url);
  } catch {
    throw new Error(
      `That page is blocking automated fetches (LinkedIn and Indeed do this). Paste the job description text and we'll keep going.`,
    );
  }
}
