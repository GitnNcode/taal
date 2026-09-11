import {
  composerSystemPrompt,
  ComposerError,
  DEFAULT_MODEL,
  requestComposition,
  type ChatMessage,
  type ComposerTarget,
} from '@/lib/composer-ai';
import { MAX_BPM, MIN_BPM, parseComposition } from '@/lib/tabla';

// The .env connection is for the local studio, never a public shared-key proxy.
function localRequest(request: Request) {
  const url = new URL(request.url);
  return (
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    (!request.headers.get('origin') ||
      request.headers.get('origin') === url.origin)
  );
}
function key() {
  const value = process.env.OPENROUTER_API_KEY;
  return typeof value === 'string' ? value.trim() : '';
}
function model() {
  const value = process.env.OPENROUTER_MODEL;
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : DEFAULT_MODEL;
}
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
export function GET(request: Request) {
  return json({ configured: localRequest(request) && !!key(), model: model() });
}
export async function POST(request: Request) {
  if (
    !localRequest(request) ||
    request.headers.get('origin') !== new URL(request.url).origin
  )
    return json(
      { error: 'This connection is only available from the local studio.' },
      403,
    );
  if (!key())
    return json(
      { error: 'Add OPENROUTER_API_KEY to .env and restart the dev server.' },
      503,
    );
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
      (input.searchWeb !== undefined && typeof input.searchWeb !== 'boolean') ||
      (input.model !== undefined &&
        (typeof input.model !== 'string' ||
          input.model.length > 160 ||
          !/^[a-zA-Z0-9~._:/-]+$/.test(input.model))) ||
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
      model: input.model || model(),
      system: composerSystemPrompt(
        input.composition,
        input.script,
        input.bpm,
        input.target as ComposerTarget,
        input.searchWeb === true,
      ),
      messages: input.messages,
      searchWeb: input.searchWeb === true,
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
