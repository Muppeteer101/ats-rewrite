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
    system: opts.system,
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
  // First try: assume the whole response is JSON.
  const trimmed = s.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  // Second try: ```json ... ``` fence.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* fall through */
    }
  }
  // Third try: pull the first balanced { ... } object.
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      /* fall through */
    }
  }
  throw new Error('Could not extract JSON from LLM response.');
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
    system: opts.system,
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
