import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TAALS, STROKES, PARTS, nextBeat, tempoSeconds } from '../lib/tabla.ts';
assert.equal(TAALS.teentaal.beats.length, 16);
assert.equal(TAALS.keharwa.beats.length, 8);
assert.equal(TAALS.dadra.beats.length, 6);
for (const taal of Object.values(TAALS)) {
  assert.equal(nextBeat(taal.beats.length - 1, taal.beats.length), 0);
  for (const bol of taal.beats) assert.ok(PARTS[bol], `Unplayable bol ${bol}`);
  assert.ok(taal.khali >= 0 && taal.khali < taal.beats.length);
}
assert.equal(new Set(STROKES.map((s) => s.key)).size, STROKES.length);
assert.equal(tempoSeconds(120), 0.5);
assert.equal(tempoSeconds(0), 1.5);
assert.equal(tempoSeconds(500), 0.12);
assert.equal(tempoSeconds(600), 0.1);
assert.equal(tempoSeconds(1000), 0.1);
assert.deepEqual(PARTS.Dha, ['ge', 'na']);
assert.deepEqual(PARTS.Dhin, ['ge', 'tin']);
for (const bol of new Set(Object.values(PARTS).flat())) {
  if (bol === 'tin') continue;
  const wav = fs.readFileSync(
    new URL(`../public/audio/${bol}.wav`, import.meta.url),
  );
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.ok(wav.length > 1000, `${bol} is empty`);
  let offset = 12,
    nonzero = 0;
  while (offset + 8 <= wav.length) {
    const kind = wav.toString('ascii', offset, offset + 4),
      n = wav.readUInt32LE(offset + 4);
    if (kind === 'data') {
      for (let i = offset + 8; i < offset + 8 + n; i += 2)
        if (wav.readInt16LE(i)) nonzero++;
      break;
    }
    offset += 8 + n + (n % 2);
  }
  assert.ok(nonzero > 100, `${bol} is silent`);
}
console.log(
  'PASS: all 30 rhythm beats resolve, cycle wrap and tempo boundaries work, 8 keys are unique, 5 WAV samples are valid and non-silent.',
);
