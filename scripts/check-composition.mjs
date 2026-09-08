import assert from 'node:assert/strict';
import {
  newComposition,
  compositionUnits,
  compositionStep,
  placeCompositionStep,
  changeCompositionStep,
  resizeComposition,
  compositionTimeline,
  fitComposition,
  parseComposition,
} from '../lib/tabla.ts';

let composition = newComposition();
assert.equal(compositionUnits(composition.steps), 64);
const insert = (
  bol,
  target = composition.steps.find((step) => step.bol === null).id,
) => {
  composition = placeCompositionStep(composition, target, { bol });
  return composition.steps.find((step) => step.bol === bol);
};
const dha = insert('Dha');
const dhin = insert('Dhin');
const rest = insert('Rest');
composition = changeCompositionStep(composition, dha.id, {
  units: 8,
  emphasis: 1.2,
});
let timeline = compositionTimeline(composition);
assert.equal(
  timeline.find((step) => step.id === dhin.id).start,
  8,
  'A two-beat Dha delays Dhin by two beats',
);
assert.equal(timeline.find((step) => step.id === rest.id).start, 12);
assert.equal(
  compositionUnits(composition.steps),
  64,
  'Changing duration retains complete cycles',
);
assert.equal(timeline.find((step) => step.id === dha.id).emphasis, 1.2);
composition = changeCompositionStep(composition, dhin.id, { units: 2 });
assert.equal(
  compositionTimeline(composition).find((step) => step.id === rest.id).start,
  10,
  'Fractional strokes use exact quarter units',
);
composition = placeCompositionStep(composition, dha.id, { id: rest.id });
assert.deepEqual(
  composition.steps.filter((step) => step.bol).map((step) => step.bol),
  ['Rest', 'Dha', 'Dhin'],
  'Drag reorders existing strokes without duplicates',
);
assert.equal(composition.steps.filter((step) => step.id === rest.id).length, 1);
const unchanged = placeCompositionStep(composition, dha.id, { id: dha.id });
assert.equal(unchanged, composition);
composition = changeCompositionStep(composition, dha.id, { units: 128 });
assert.equal(
  compositionUnits(composition.steps),
  192,
  'An extended bol grows to whole cycles',
);
assert.ok(
  composition.steps.some((step) => step.id === dhin.id),
  'Extending never overwrites following bols',
);
composition = resizeComposition(composition, 7);
assert.equal(
  compositionUnits(composition.steps) % 28,
  0,
  'Resizing uses the new cycle multiple',
);
assert.ok(composition.steps.some((step) => step.id === dha.id));
const restored = parseComposition(JSON.parse(JSON.stringify(composition)));
assert.deepEqual(
  restored.steps.map(({ bol, units, emphasis }) => ({ bol, units, emphasis })),
  composition.steps.map(({ bol, units, emphasis }) => ({
    bol,
    units,
    emphasis,
  })),
);
assert.equal(
  new Set(restored.steps.map((step) => step.id)).size,
  restored.steps.length,
);
assert.throws(() => resizeComposition(composition, 0));
assert.throws(() => resizeComposition(composition, 65));
assert.throws(() => changeCompositionStep(composition, dha.id, { units: 0.5 }));
assert.throws(() =>
  changeCompositionStep(composition, dha.id, { emphasis: Infinity }),
);
assert.throws(() =>
  parseComposition({ ...composition, steps: [{ ...dha, bol: 'unknown' }] }),
);
assert.throws(() =>
  parseComposition({ ...composition, steps: [{ ...dha, units: 0 }] }),
);
assert.throws(() => parseComposition({ ...composition, steps: [dha] }));
// Exhaust short phrase lengths and cycle sizes; every note survives padding and resizing.
for (const beats of [1, 3, 6, 7, 8, 16, 64])
  for (const units of [1, 2, 3, 4, 6, 8, 15, 32, 65, 256]) {
    const steps = [
      compositionStep('Dha', units),
      compositionStep('Rest', 3),
      compositionStep('Tin', 2),
    ];
    const fitted = fitComposition(steps, beats);
    assert.equal(compositionUnits(fitted) % (beats * 4), 0);
    assert.deepEqual(
      fitted.filter((step) => step.bol).map((step) => step.id),
      steps.map((step) => step.id),
    );
    const events = compositionTimeline({
      version: 1,
      name: 'check',
      beatsPerCycle: beats,
      steps: fitted,
    });
    assert.equal(events[1].start, units);
    assert.equal(
      events[2].start,
      units + 3,
      'A rest delays the following strike',
    );
  }
console.log(
  'PASS: drag insertion/reordering, rests, fractional duration, emphasis, cycle extension/resizing, lossless saving, invalid imports, and 70 timing combinations.',
);
