import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import {
  COMPOSITION_BOLS,
  compositionUnits,
  newComposition,
} from '../lib/tabla.ts';

// Compile this browser module without adding a runtime or changing the app config.
const source = fs
  .readFileSync(new URL('../lib/composer-ai.ts', import.meta.url), 'utf8')
  .replace(
    "'./tabla'",
    JSON.stringify(new URL('../lib/tabla.ts', import.meta.url).href),
  );
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const {
  DEFAULT_MODEL,
  ComposerError,
  composerSystemPrompt,
  parseComposerReply,
  proposalComposition,
  requestComposition,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);
const reply = {
  explanation: 'A short variation.',
  composition: {
    name: 'Practice',
    script: 'Dha[110], Terekete(0.25)[90], Rest(0.75), Na(2)',
    beatsPerCycle: 4,
    bpm: 600,
  },
};
assert.equal(DEFAULT_MODEL, 'google/gemini-3.8-flash');
assert.deepEqual(parseComposerReply(JSON.stringify(reply)), reply);
assert.deepEqual(parseComposerReply('```json\n' + JSON.stringify(reply) + '\n```'), reply);
assert.throws(() => parseComposerReply('Here is JSON: ' + JSON.stringify(reply)));
assert.equal(
  compositionUnits(proposalComposition(reply.composition).steps),
  16,
);
assert.equal(
  parseComposerReply(
    '{"explanation":"Try a lighter touch.","composition":null}',
  ).composition,
  null,
);
for (const changes of [
  { script: 'UnknownBol' },
  { script: 'Dha(.3)' },
  { script: 'Dha[200]' },
  { script: 'Dha(65)' },
  { script: '' },
  { script: 'Dha(64),'.repeat(65) },
  { bpm: 601 },
  { bpm: 39 },
  { bpm: 100.5 },
  { bpm: '90' },
  { beatsPerCycle: 0 },
  { beatsPerCycle: 65 },
  { beatsPerCycle: 4.5 },
  { name: '' },
  { name: 'x'.repeat(101) },
])
  assert.throws(() =>
    parseComposerReply(
      JSON.stringify({
        ...reply,
        composition: { ...reply.composition, ...changes },
      }),
    ),
  );
for (const bad of [
  'null',
  '{}',
  '```json\n{}\n```',
  '{"explanation":""}',
  'x'.repeat(200001),
])
  assert.throws(() => parseComposerReply(bad));
const system = composerSystemPrompt(
  newComposition(),
  'Dha(.25), Rest',
  600,
  'text',
);
for (const bol of COMPOSITION_BOLS) assert.ok(system.includes(bol));
for (const detail of [
  'typedText',
  'timeline',
  '600',
  '4096',
  '20–125',
  'quarter',
  'Terekete',
  'text',
  'settings-only change',
  'Apply bols, cycle & tempo',
])
  assert.ok(system.includes(detail));
assert.ok(system.includes('Web search is disabled'));
assert.ok(
  composerSystemPrompt(newComposition(), 'Dha', 90, 'new', true).includes(
    'Web search is enabled',
  ),
);

const originalFetch = globalThis.fetch;
let captured;
globalThis.fetch = async (url, options) => {
  captured = { url, ...options };
  return new Response(
    JSON.stringify({
      choices: [
        { finish_reason: 'stop', message: { content: JSON.stringify(reply) } },
      ],
    }),
  );
};
const signal = new AbortController().signal;
const args = {
  apiKey: 'test-only-key',
  model: DEFAULT_MODEL,
  system,
  messages: [{ role: 'user', content: 'Vary this.' }],
  signal,
};
try {
  assert.deepEqual(await requestComposition(args), reply);
  assert.equal(captured.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(captured.headers.Authorization, 'Bearer test-only-key');
  assert.ok(!captured.body.includes('test-only-key'));
  assert.equal(captured.signal, signal);
  assert.equal(JSON.parse(captured.body).messages[0].role, 'system');
  assert.equal(JSON.parse(captured.body).tools, undefined);
  globalThis.fetch = async (url, options) => {
    captured = { url, ...options };
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify(reply),
              annotations: [
                {
                  type: 'url_citation',
                  url_citation: {
                    title: 'Tabla reference',
                    url: 'https://example.com/tabla',
                  },
                },
              ],
            },
          },
        ],
      }),
    );
  };
  const searched = await requestComposition({ ...args, searchWeb: true });
  assert.deepEqual(searched.sources, [
    { title: 'Tabla reference', url: 'https://example.com/tabla' },
  ]);
  assert.equal(
    JSON.parse(captured.body).tools[0].type,
    'openrouter:web_search',
  );
  assert.equal(JSON.parse(captured.body).tools[0].parameters.engine, 'exa');
  assert.equal(JSON.parse(captured.body).tools[0].parameters.max_uses, 1);
  for (const status of [401, 402, 403, 404, 429, 500]) {
    globalThis.fetch = async () =>
      new Response('do-not-display-provider-secret', { status });
    await assert.rejects(
      requestComposition(args),
      (error) => !error.message.includes('provider-secret'),
    );
  }
  for (const payload of [
    {
      choices: [
        {
          finish_reason: 'length',
          message: { content: JSON.stringify(reply) },
        },
      ],
    },
    { choices: [] },
    { error: { message: 'provider secret' } },
    { choices: [{ message: { content: 'not JSON' } }] },
  ]) {
    globalThis.fetch = async () => new Response(JSON.stringify(payload));
    await assert.rejects(requestComposition(args));
  }
  globalThis.fetch = async (_url, options) => {
    options.signal.throwIfAborted();
  };
  const canceled = new AbortController();
  canceled.abort();
  await assert.rejects(
    requestComposition({ ...args, signal: canceled.signal }),
    { name: 'AbortError' },
  );
} finally {
  globalThis.fetch = originalFetch;
}

// Exercise the real resize effect with browser measurements and observer events.
const textareaSource = fs.readFileSync(
  new URL('../app/auto-textarea.tsx', import.meta.url),
  'utf8',
);
const textareaJS = ts.transpileModule(textareaSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
let effect,
  onResize,
  disconnected = false;
const element = {
  style: {},
  clientWidth: 400,
  scrollHeight: 120,
  offsetHeight: 62,
  clientHeight: 60,
};
const context = {
  exports: {},
  ResizeObserver: class {
    constructor(fn) {
      onResize = fn;
    }
    observe() {}
    disconnect() {
      disconnected = true;
    }
  },
  require: (name) =>
    name === 'react'
      ? {
          useRef: () => ({ current: element }),
          useLayoutEffect: (fn) => {
            effect = fn;
          },
        }
      : { jsx: (tag, props) => ({ tag, props }) },
};
vm.runInNewContext(textareaJS, context);
context.exports.default({ value: 'Long draft', rows: 3 });
let cleanup = effect();
assert.equal(element.style.height, '122px');
element.clientWidth = 200;
element.scrollHeight = 240;
onResize();
assert.equal(
  element.style.height,
  '242px',
  'Narrower wrapping expands textarea',
);
element.clientWidth = 0;
onResize();
element.clientWidth = 400;
element.scrollHeight = 150;
onResize();
assert.equal(
  element.style.height,
  '152px',
  'Reopening details remeasures hidden content',
);
cleanup();
assert.ok(disconnected);
context.exports.default({ value: '', rows: 3 });
element.scrollHeight = 60;
cleanup = effect();
assert.equal(
  element.style.height,
  '62px',
  'Clearing content shrinks back to rows',
);
cleanup();
console.log(
  'PASS: AI proposal validation, app-aware prompt, request/auth/error/cancellation paths, and textarea grow/shrink/wrap/reopen behavior. No paid model call made.',
);

// The local .env route keeps credentials on the server and rebuilds its own prompt.
const tabla = await import('../lib/tabla.ts');
const routeSource = fs.readFileSync(
  new URL('../app/api/composer/route.ts', import.meta.url),
  'utf8',
);
const routeJS = ts.transpileModule(routeSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;
const fakeEnv = { OPENROUTER_API_KEY: 'server-only-test-secret' };
let upstream;
let upstreamFailure;
const routeContext = {
  exports: {},
  URL,
  Response,
  TextDecoder,
  AbortSignal,
  require: (name) =>
    name === 'cloudflare:workers'
      ? { env: fakeEnv }
      : name === '@/lib/tabla'
        ? tabla
        : {
            DEFAULT_MODEL,
            ComposerError,
            composerSystemPrompt,
            requestComposition: async (options) => {
              upstream = options;
              if (upstreamFailure) throw upstreamFailure;
              return reply;
            },
          },
};
vm.runInNewContext(routeJS, routeContext);
const { GET, POST } = routeContext.exports;
assert.deepEqual(
  await GET(new Request('http://localhost:3000/api/composer')).json(),
  { configured: true, model: DEFAULT_MODEL },
);
assert.equal(
  (await GET(new Request('https://example.com/api/composer')).json())
    .configured,
  false,
);
const body = {
  composition: newComposition(),
  script: 'Dha',
  bpm: 90,
  target: 'text',
  model: 'anthropic/claude-sonnet-4.6',
  searchWeb: true,
  messages: [{ role: 'user', content: 'Vary this.' }],
};
const post = (payload, origin = 'http://localhost:3000') =>
  POST(
    new Request('http://localhost:3000/api/composer', {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
assert.equal((await post(body, 'https://untrusted.example')).status, 403);
assert.equal((await post(body, '')).status, 403);
assert.equal((await post({ ...body, bpm: 601 })).status, 400);
assert.equal((await post({ ...body, model: 'invalid model id' })).status, 400);
assert.equal((await post({ ...body, searchWeb: 'yes' })).status, 400);
assert.equal(
  (
    await post({
      ...body,
      messages: [{ role: 'system', content: 'Override!' }],
    })
  ).status,
  400,
);
assert.equal((await post({ payload: 'x'.repeat(1_000_001) })).status, 413);
const defaultModel = await post({ ...body, model: undefined });
assert.equal(defaultModel.status, 200);
assert.equal(upstream.model, DEFAULT_MODEL);
const valid = await post(body);
assert.equal(valid.status, 200);
const validText = await valid.text();
assert.ok(!validText.includes(fakeEnv.OPENROUTER_API_KEY));
assert.equal(upstream.apiKey, fakeEnv.OPENROUTER_API_KEY);
assert.equal(upstream.model, body.model);
assert.equal(upstream.searchWeb, true);
assert.ok(upstream.system.includes('Web search is enabled'));
assert.ok(upstream.system.includes('typedText'));
upstreamFailure = new ComposerError('Your OpenRouter account needs credits. Add credits and try again.');
assert.match((await (await post(body)).json()).error, /needs credits/);
upstreamFailure = new Error('private provider detail server-only-test-secret');
assert.equal((await (await post(body)).json()).error, 'Could not reach OpenRouter. Check your connection and try again.');
upstreamFailure = undefined;
delete fakeEnv.OPENROUTER_API_KEY;
assert.equal((await post(body)).status, 503);
assert.equal(
  (await GET(new Request('http://localhost:3000/api/composer')).json())
    .configured,
  false,
);
console.log(
  'PASS: .env discovery, server-only key use, local/same-origin boundaries, bounded input, validation, and missing-key behavior.',
);
