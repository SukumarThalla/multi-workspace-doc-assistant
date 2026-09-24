import { Readable } from 'stream';

// Ordered by preference. Each has its own free-tier daily quota bucket, so when one
// is exhausted the caller can retry the same request against the next one.
export const AVAILABLE_MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];
export const DEFAULT_MODEL = AVAILABLE_MODELS[0];

// Gemini's free-tier daily quotas reset at midnight Pacific time, not after the short
// `retryDelay` the API suggests (that's a generic backoff hint, not the real quota window).
function getPacificOffsetMinutes(date) {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const laDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return (utcDate - laDate) / 60000;
}

export function getQuotaResetTime(now = new Date()) {
  const offsetMinutes = getPacificOffsetMinutes(now);
  const laWallClock = new Date(now.getTime() - offsetMinutes * 60000);
  const nextMidnightWallClock = new Date(
    Date.UTC(laWallClock.getUTCFullYear(), laWallClock.getUTCMonth(), laWallClock.getUTCDate() + 1, 0, 0, 0)
  );
  return new Date(nextMidnightWallClock.getTime() + offsetMinutes * 60000);
}

export class QuotaExceededError extends Error {
  constructor(model) {
    super(`Gemini quota exceeded for model ${model}`);
    this.name = 'QuotaExceededError';
    this.model = model;
    this.resetsAt = getQuotaResetTime().toISOString();
  }
}

// Streams a chat turn from Gemini token-by-token.
// `contents` is Gemini's message array: [{ role: 'user'|'model', parts: [...] }, ...]
// Yields { type: 'text', text } deltas, or a single
// { type: 'tool_call', name, args, id, thoughtSignature } if the model calls a tool instead of answering.
// `id` and `thoughtSignature` must be echoed back verbatim in the next turn's functionCall part —
// newer Gemini models reject multi-turn tool calls without them.
export async function* streamGenerateContent({ model = DEFAULT_MODEL, systemInstruction, contents, tools }) {
  const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;
  const body = {
    contents,
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
    ...(tools ? { tools: [{ functionDeclarations: tools }] } : {}),
  };

  const res = await fetch(`${streamUrl}?alt=sse&key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const errBody = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(errBody);
    } catch {
      // not JSON — fall through to the generic error below
    }
    if (res.status === 429 && parsed?.error?.status === 'RESOURCE_EXHAUSTED') {
      throw new QuotaExceededError(model);
    }
    throw new Error(`Gemini stream request failed (${res.status}): ${errBody}`);
  }

  let buffer = '';
  for await (const chunk of Readable.fromWeb(res.body)) {
    buffer += chunk.toString('utf-8');
    const lines = buffer.split('\n');
    buffer = lines.pop(); // last line may be incomplete — keep it for the next chunk

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;

      const parsed = JSON.parse(jsonStr);
      const parts = parsed.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.functionCall) {
          yield {
            type: 'tool_call',
            name: part.functionCall.name,
            args: part.functionCall.args || {},
            id: part.functionCall.id,
            thoughtSignature: part.thoughtSignature,
          };
        } else if (part.text) {
          yield { type: 'text', text: part.text };
        }
      }
    }
  }
}
