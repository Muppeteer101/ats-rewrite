import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.',
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export const MODELS = {
  // Per ats-engine-architecture.md §3 — Sonnet for analysis + rewrite, Haiku for scoring.
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
} as const;

/**
 * Run a non-streaming Anthropic call expecting a JSON object response,
 * then validate it with the supplied Zod schema. Returns the parsed object.
 *
 * Anthropic doesn't have a native JSON mode like OpenAI does, so we lean on
 * a strict prompt + a defensive JSON extraction step. We accept either a raw
 * JSON object or a JSON object inside a single ```json fence (the model
 * sometimes adds one despite the instruction).
 */
export async function callJson<T>(opts: {
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const res = await client().messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.1,
    // Prompt caching: system prompt is stable across users, so cache it
    // for 5 min. Anthropic charges 1.25x on write, 0.1x on read — we break
    // even at 3 uses within the window.
    system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: opts.user }],
  });

  const block = res.content.find((c) => c.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('LLM returned no text block.');
  }

  const json = extractJson(block.text);
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    // Surface the validation error clearly — usually means the prompt
    // needs a tweak to enforce a missing field.
    throw new Error(
      `LLM output failed schema validation: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  return parsed.data;
}

function extractJson(s: string): unknown {
  let trimmed = s.trim();

  // Strip an opening ```json (or ```) fence if present, so we can look at
  // what's inside even when the model didn't write the closing fence
  // (e.g. when max_tokens truncated the response).
  trimmed = trimmed.replace(/^```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');

  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  // Pull the largest balanced { ... } object.
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      /* fall through */
    }
  }
  // Last-ditch: try to repair common truncation by finding the last complete
  // top-level value and closing the object. Reasonable for our schemas where
  // missing optional fields won't fail Zod.
  if (first >= 0) {
    const repaired = repairTruncatedJson(trimmed.slice(first));
    if (repaired !== null) {
      try {
        return JSON.parse(repaired);
      } catch {
        /* fall through */
      }
    }
  }

  const preview = trimmed.slice(0, 400).replace(/\n/g, '\\n');
  console.error('[extractJson] failed to parse:', preview);
  throw new Error(`Could not extract JSON from LLM response. First 400 chars: ${preview}`);
}

/**
 * Best-effort closer for a JSON string that was truncated mid-output.
 * Walks through the chars tracking string state + brace/bracket depth, then
 * appends the right number of `}` and `]` to close the open structures.
 * Drops any trailing partial token (string/number) before the close.
 */
function repairTruncatedJson(s: string): string | null {
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  let lastSafeIndex = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (inString) {
      if (ch === '"') {
        inString = false;
        lastSafeIndex = i;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.pop() !== ch) return null; // mismatched
      lastSafeIndex = i;
    } else if (ch === ',' || ch === ':') {
      lastSafeIndex = i;
    } else if (/[\d.\-+eE]/.test(ch)) {
      lastSafeIndex = i;
    } else if (/[a-zA-Z]/.test(ch)) {
      // partial keyword like "tru" or "nul" — not safe to close here
    }
  }

  if (lastSafeIndex < 0) return null;
  // Trim back to last safe index; if it ended with a comma, drop it.
  let trimmed = s.slice(0, lastSafeIndex + 1);
  trimmed = trimmed.replace(/,\s*$/, '');
  return trimmed + stack.reverse().join('');
}

/** Stream a JSON-producing call, yielding text deltas as they arrive. */
export async function* streamText(opts: {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): AsyncGenerator<string, string, void> {
  const stream = client().messages.stream({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 8192,
    temperature: opts.temperature ?? 0.4,
    // Prompt caching on the rewrite system prompt — biggest cache win.
    system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: opts.user }],
  });

  let full = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      full += event.delta.text;
      yield event.delta.text;
    }
  }
  return full;
}
