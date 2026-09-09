import assert from 'node:assert/strict';
import { audibleContextTime } from '../lib/tabla.ts';

let stamp = { contextTime: 0, performanceTime: 0 };
const ctx = {state: 'running', currentTime: 4, baseLatency: .1, outputLatency: .2,
  getOutputTimestamp: () => stamp};
const firstBeat = 1.01;
assert.equal(audibleContextTime(ctx), -Infinity, 'Unstarted output must retain loading');
stamp = {contextTime: 1, performanceTime: 100};
assert.ok(audibleContextTime(ctx) < firstBeat, 'Render clock several beats ahead must not start visuals');
assert.equal(audibleContextTime(ctx), .994, 'Use output timestamp without subtracting device latency twice');
assert.equal(audibleContextTime(ctx), .994, 'Stalled output must not advance through wall time');
stamp.contextTime = 1.02;
assert.ok(audibleContextTime(ctx) >= firstBeat, 'Begin visuals when first beat reaches output');
ctx.state = 'suspended';
assert.equal(audibleContextTime(ctx), -Infinity);
ctx.state = 'running';
delete ctx.getOutputTimestamp;
assert.ok(Math.abs(audibleContextTime(ctx) - 3.694) < 1e-10, 'Older browsers subtract estimated latency');
console.log('Audio output timing checks passed');
