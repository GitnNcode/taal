import assert from 'node:assert/strict';
import {
  parseBolScript,
  fitComposition,
  compositionUnits,
  changeCompositionStep,
  compositionStep,
  formatBolScript,
} from '../lib/tabla.ts';
const steps = parseBolScript(
  ' dha, DHIN, terekete, Kran, pause, -, Rest,\n Na, ',
);
assert.deepEqual(
  steps.map((s) => s.bol),
  ['Dha', 'Dhin', 'Terekete', 'Kran', 'Rest', 'Rest', 'Rest', 'Na'],
);
assert.ok(steps.every((s) => s.units === 4 && s.emphasis === 0.8));
assert.equal(new Set(steps.map((s) => s.id)).size, 8);
const timed = parseBolScript(
  'Terekete(2)[95], Dha(.5)[125], Rest(1.25)[20], Na',
);
assert.deepEqual(
  timed.map(({ bol, units, emphasis }) => [bol, units, emphasis]),
  [
    ['Terekete', 8, 0.95],
    ['Dha', 2, 1.25],
    ['Rest', 5, 0.2],
    ['Na', 4, 0.8],
  ],
);
assert.throws(() => parseBolScript('Dha, typo'), /Unknown bols: typo/);
assert.throws(() => parseBolScript('Dha(0)'), /0.25/);
assert.throws(() => parseBolScript('Dha(0.3)'), /quarter-beat/);
assert.throws(() => parseBolScript('Dha(two)'), /Could not read/);
assert.throws(() => parseBolScript('Dha[19]'), /20–125/);
assert.throws(() => parseBolScript('Dha[126]'), /20–125/);
assert.throws(() => parseBolScript('Dha[90%]'), /Could not read/);
const formatted = formatBolScript([
  compositionStep('Dha', 8),
  compositionStep(null, 2),
  compositionStep('Terekete', 1),
  { ...compositionStep('Rest', 5), emphasis: 1.125 },
  compositionStep(null, 4),
]);
assert.equal(formatted, 'Dha(2), Rest(0.5), Terekete(0.25), Rest(1.25)[112.5]');
assert.deepEqual(
  parseBolScript(formatted).map(({ bol, units, emphasis }) => [
    bol,
    units,
    emphasis,
  ]),
  [
    ['Dha', 8, 0.8],
    ['Rest', 2, 0.8],
    ['Terekete', 1, 0.8],
    ['Rest', 5, 1.125],
  ],
);
assert.throws(() => parseBolScript(', \n'), /at least one bol/);
assert.throws(
  () => parseBolScript(Array(4097).fill('Dha').join(',')),
  /at most/,
);
const composition = {
  version: 1,
  name: 'Script',
  beatsPerCycle: 6,
  steps: fitComposition(steps, 6),
};
assert.equal(compositionUnits(composition.steps), 48);
assert.deepEqual(composition.steps.slice(0, 8), steps);
const edited = changeCompositionStep(composition, steps[0].id, {
  units: 8,
  emphasis: 1,
});
assert.equal(edited.steps[0].units, 8);
assert.equal(edited.steps[0].emphasis, 1);
assert.equal(compositionUnits(edited.steps) % 24, 0);
console.log(
  'PASS: script parsing, rests, validation, cycle padding, and UI length/emphasis edits.',
);

assert.equal(parseBolScript('kredhit')[0].bol, 'Kredhit');
