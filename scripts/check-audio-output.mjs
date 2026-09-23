import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { audibleContextTime, bolHits } from '../lib/tabla.ts';

let stamp = { contextTime: 0, performanceTime: 0 };
const ctx = {
  state: 'running',
  currentTime: 4,
  baseLatency: 0.1,
  outputLatency: 0.2,
  getOutputTimestamp: () => stamp,
};
const firstBeat = 1.01;
assert.equal(
  audibleContextTime(ctx),
  -Infinity,
  'Unstarted output must retain loading',
);
stamp = { contextTime: 1, performanceTime: 100 };
assert.ok(
  audibleContextTime(ctx, 100) < firstBeat,
  'Render clock several beats ahead must not start visuals',
);
assert.equal(
  audibleContextTime(ctx, 100),
  0.994,
  'Use output timestamp without subtracting device latency twice',
);
assert.ok(
  Math.abs(audibleContextTime(ctx, 120) - 1.014) < 1e-10,
  'Interpolate output clock to the current animation frame',
);
assert.equal(
  audibleContextTime(ctx, 1000),
  audibleContextTime(ctx, 2000),
  'Stalled output must not keep advancing through wall time',
);
assert.equal(
  audibleContextTime(ctx, 80),
  0.994,
  'Future timestamp cannot move animation backwards',
);
stamp.contextTime = 1.02;
assert.ok(
  audibleContextTime(ctx) >= firstBeat,
  'Begin visuals when first beat reaches output',
);
// Safari-style timestamp: render clock, no device latency. Fall back to the latency estimate.
stamp = { contextTime: 3.99, performanceTime: 100 };
assert.ok(
  Math.abs(audibleContextTime(ctx, 100) - 3.694) < 1e-10,
  'Prefer the estimate that accounts for more latency',
);
ctx.state = 'suspended';
assert.equal(audibleContextTime(ctx), -Infinity);
ctx.state = 'running';
delete ctx.getOutputTimestamp;
assert.ok(
  Math.abs(audibleContextTime(ctx) - 3.694) < 1e-10,
  'Older browsers subtract estimated latency',
);
console.log('Audio output timing checks passed');

// Preview flashes also wait for output, including each stroke of a phrase.
const source = fs.readFileSync(
  new URL('../app/use-bol-flash.ts', import.meta.url),
  'utf8',
);
const start = source.indexOf('const flashWhenAudible = useCallback(');
const end = source.indexOf('  const clearFlashes = useCallback(', start);
assert.ok(start >= 0 && end > start);
let outputTime = 0,
  nextFrame;
const flashes = [];
const audio = { context: {} },
  engine = { current: audio };
const flashWhenAudible = vm.runInNewContext(
  ts.transpileModule(source.slice(start, end) + '\nflashWhenAudible;', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    useCallback: (fn) => fn,
    bolHits,
    engine,
    mounted: { current: true },
    previewFrames: { current: new Set() },
    performance: { now: () => outputTime * 1000 },
    audibleContextTime: () => outputTime,
    requestAnimationFrame: (fn) => {
      nextFrame = fn;
      return 1;
    },
    flash: (bol) => flashes.push(bol),
  },
);
flashWhenAudible(audio, 'Terekete', 1, 1);
assert.equal(flashes.length, 0, 'No early flash while sound is still buffered');
for (const time of [1, 1.25, 1.5, 1.75]) {
  outputTime = time;
  nextFrame();
}
assert.deepEqual(flashes, ['Te', 'Re', 'Ke', 'Te']);
flashWhenAudible(audio, 'Dha', 2, 1);
engine.current = {};
outputTime = 2;
nextFrame();
assert.equal(flashes.length, 4, 'Resetting audio cancels old preview flashes');
console.log(
  'PASS: preview and phrase flashes follow actual output; audio reset cancels stale frames.',
);
