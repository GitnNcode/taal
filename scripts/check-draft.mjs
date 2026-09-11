import assert from 'node:assert/strict';
import { newComposition, parseCompositionDraft, formatBolScript } from '../lib/tabla.ts';

const composition = { ...newComposition(), name: 'Evening practice' };
const stored = JSON.stringify({ ...composition, bpm: 137, script: 'Terekete(2), Dha — unfinished' });
const restored = parseCompositionDraft(JSON.parse(stored));
assert.equal(restored.composition.name, composition.name);
assert.equal(restored.bpm, 137);
assert.equal(restored.script, 'Terekete(2), Dha — unfinished');
assert.deepEqual(restored.composition.steps.map(({id, ...step}) => step), composition.steps.map(({id, ...step}) => step));
const legacy = parseCompositionDraft(composition);
assert.equal(legacy.bpm, 90);
assert.equal(legacy.script, formatBolScript(composition.steps));
for (const bpm of [null, '120', 0, 601, 90.5, NaN])
  assert.equal(parseCompositionDraft({ ...composition, bpm }).bpm, 90);
assert.equal(parseCompositionDraft({ ...composition, script: '' }).script, '');
assert.throws(() => parseCompositionDraft({ version: 1 }));
console.log('PASS: name, tempo, beats, unfinished text, old drafts, and invalid saved data.');
