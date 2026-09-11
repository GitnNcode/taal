import assert from 'node:assert/strict';
import { COMPOSITION_BOLS, PARTS, bolHits, tempoSeconds, trackPosition } from '../lib/tabla.ts';

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

// The playhead is derived from the compiled track, never timer tick counts.
for (const bpm of [40, 90, 240, 600]) {
  const units = 16 * 4;
  const frames = Math.round(units * tempoSeconds(bpm) / 4 * 44100);
  const secondsPerUnit = frames / 44100 / units;
  const playback = { when: 3, offsetUnits: 0, track: { units, secondsPerUnit } };
  for (const position of [0, 1, 4, 63, 64, 128, 640000]) {
    const time = playback.when + position * secondsPerUnit;
    assert.ok(Math.abs(trackPosition(playback, time) - position) < 1e-7);
  }
  const swapTime = 4.27;
  const position = trackPosition(playback, swapTime);
  const replacement = { when: swapTime, offsetUnits: position, track: { units, secondsPerUnit: secondsPerUnit / 2 } };
  assert.equal(trackPosition(replacement, swapTime), position, 'Tempo replacement starts at the identical audio position');
  assert.ok(Math.abs(trackPosition(replacement, swapTime + secondsPerUnit / 2) - position - 1) < 1e-10);
}
console.log('PASS: all bols at every duration through 600 BPM; compiled playhead has no cumulative drift through 10,000 cycles; tempo swaps preserve position.');
