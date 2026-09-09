import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { COMPOSITION_BOLS, PARTS, TAALS, bolHits, nextBeat, tempoSeconds } from '../lib/tabla.ts';

// Every supported duration, including 25 ms quarter-beats at 600 BPM.
for (const bpm of [40, 240, 500, 599, 600]) {
  for (let units = 1; units <= 256; units++) {
    const duration = tempoSeconds(bpm) * units / 4;
    for (const bol of COMPOSITION_BOLS) {
      const hits = bolHits(bol, duration);
      assert.ok(hits.length, `${bol} at ${bpm} BPM`);
      hits.forEach((hit, index) => {
        assert.ok(PARTS[hit.bol]?.length);
        assert.ok(hit.offset >= 0 && hit.offset < duration);
        if (index) assert.ok(hit.offset > hits[index - 1].offset);
      });
    }
  }
}

// Execute the actual scheduler and animation callbacks with a controlled clock.
const source = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
function callback(name, end, scope) {
  const start = source.indexOf(`const ${name} = () => {`);
  assert.ok(start >= 0);
  const finish = source.indexOf(end, start);
  assert.ok(finish > start);
  const code = ts.transpileModule(`${source.slice(start, finish)}\n${name};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return vm.runInNewContext(code, scope);
}
for (const taal of Object.keys(TAALS)) {
  const played = [], flashes = [], positions = [], visualQueue = [];
  const context = { currentTime: 0 };
  const scope = {
    engine: { current: { context, play: (...args) => played.push(args) } },
    config: { current: { bpm: 600, taal, metronome: false } },
    composition: null, totalUnits: 0, events: null, unit: 0, when: 0,
    TAALS, nextBeat, tempoSeconds, visualQueue,
    mounted: { current: true }, generation: 1, playbackGeneration: { current: 1 },
    audibleContextTime: () => context.currentTime, began: true,
    setBeat: (beat) => positions.push(beat),
    flash: (bol, duration) => flashes.push({ bol, duration }),
    playbackFrame: { current: null }, requestAnimationFrame: () => 1,
  };
  const tick = callback('tick', '\n      playMode.current = mode;', scope);
  const draw = callback('draw', '\n        playbackFrame.current = requestAnimationFrame(draw);', scope);
  // 30 fps: some frames contain both a bol and the next empty subdivision.
  const cycleSeconds = TAALS[taal].beats.length * .1;
  for (let frame = 0; frame <= Math.ceil(cycleSeconds * 30); frame++) {
    context.currentTime = frame / 30;
    tick();
    draw();
  }
  const beats = TAALS[taal].beats;
  assert.deepEqual(played.slice(0, beats.length).map(([bol]) => bol), beats);
  assert.deepEqual(flashes.slice(0, beats.length).map(({ bol }) => bol), beats);
  assert.ok(flashes.every(({ duration }) => duration === 20));
  assert.ok(beats.every((_, index) => positions.includes(index)));
  played.forEach(([, time, , , duration], index) => {
    assert.ok(Math.abs(time - index * .1) < 1e-9);
    assert.equal(duration, .1);
  });
}
console.log('PASS: all bols across 256 durations and five tempos; 600 BPM scheduling, cycle wrapping, and bol/beat visuals at 30 fps for every taal.');
