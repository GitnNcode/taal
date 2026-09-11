import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
  composerSystemPrompt,
  ComposerError,
  DEFAULT_MODEL,
  requestComposition,
  type ChatMessage,
  type ComposerTarget,
} from '@/lib/composer-ai';
import { MAX_BPM, MIN_BPM, parseComposition } from '@/lib/tabla';

const DAILY_MESSAGE_LIMIT = 3;
let rateLimiter: Ratelimit | undefined;

function localRequest(request: Request) {
  const url = new URL(request.url);
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}
function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
function key() {
  const value = process.env.OPENROUTER_API_KEY;
  return typeof value === 'string' ? value.trim() : '';
}
function rateLimitConfigured() {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN &&
    process.env.RATE_LIMIT_SECRET
  );
}
function limiter() {
  if (!rateLimiter) {
    rateLimiter = new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.fixedWindow(DAILY_MESSAGE_LIMIT, '1 d'),
      prefix: 'taal:composer',
    });
  }
  return rateLimiter;
}
async function visitorId(request: Request) {
  const address =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const signingKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.RATE_LIMIT_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    signingKey,
    new TextEncoder().encode(address),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
export function GET(request: Request) {
  return json({
    configured:
      !!key() && (localRequest(request) || rateLimitConfigured()),
    model: DEFAULT_MODEL,
    searchWeb: true,
    dailyMessageLimit: DAILY_MESSAGE_LIMIT,
  });
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json(
      { error: 'This connection only accepts requests from this site.' },
      403,
    );
  if (!key())
    return json(
      { error: 'The AI assistant is not configured.' },
      503,
    );
  if (!localRequest(request)) {
    if (!rateLimitConfigured())
      return json({ error: 'The AI message limit is not configured.' }, 503);
    try {
      const result = await limiter().limit(await visitorId(request));
      if (!result.success)
        return json(
          { error: 'You have used today’s 3 AI messages. Try again tomorrow.' },
          429,
        );
    } catch {
      // Never expose a paid shared key when its abuse protection is unavailable.
      return json(
        { error: 'The AI message limit is temporarily unavailable.' },
        503,
      );
    }
  }
  let input;
  try {
    // Bound the body even when a caller omits Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Missing request.');
    const chunks: string[] = [];
    const decoder = new TextDecoder();
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_000_000) {
        await reader.cancel();
        return json(
          { error: 'This draft is too large. Shorten it and try again.' },
          413,
        );
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    const text = chunks.join('') + decoder.decode();
    input = JSON.parse(text);
    const composition = parseComposition(input.composition);
    if (
      typeof input.script !== 'string' ||
      input.script.length > 100000 ||
      !Number.isInteger(input.bpm) ||
      input.bpm < MIN_BPM ||
      input.bpm > MAX_BPM ||
      !['text', 'timeline', 'new'].includes(input.target) ||
      !Array.isArray(input.messages) ||
      input.messages.length < 1 ||
      input.messages.length > 9 ||
      input.messages.some(
        (message: ChatMessage) =>
          !message ||
          !['user', 'assistant'].includes(message.role) ||
          typeof message.content !== 'string' ||
          !message.content.trim() ||
          message.content.length > 200000,
      ) ||
      input.messages.at(-1).role !== 'user' ||
      input.messages.at(-1).content.length > 4000
    )
      throw new Error('Invalid request.');
    input = { ...input, composition };
  } catch {
    return json(
      {
        error:
          'The composition request is invalid. Shorten your draft or reload and try again.',
      },
      400,
    );
  }
  try {
    const reply = await requestComposition({
      apiKey: key(),
      model: DEFAULT_MODEL,
      system: composerSystemPrompt(
        input.composition,
        input.script,
        input.bpm,
        input.target as ComposerTarget,
        true,
      ),
      messages: input.messages,
      searchWeb: true,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(85000)]),
    });
    return json(reply);
  } catch (error) {
    // Never relay an upstream error that might echo credentials or request headers.
    return json(
      {
        error:
          error instanceof ComposerError
            ? error.message
            : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
              ? 'The model took too long or the request was canceled. Try a shorter request or another model.'
              : 'Could not reach OpenRouter. Check your connection and try again.',
      },
      502,
    );
  }
}
