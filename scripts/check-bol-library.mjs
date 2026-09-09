import assert from 'node:assert/strict';
import { COMPOSITION_BOLS, PHRASES, PARTS, bolHits, compositionStep, fitComposition, parseComposition } from '../lib/tabla.ts';
assert.equal(new Set(COMPOSITION_BOLS).size, COMPOSITION_BOLS.length);
for (const name of COMPOSITION_BOLS) {
  const hits = bolHits(name, .8);
  assert.ok(hits.length > 0, `${name} must play`);
  for (const hit of hits) {
    assert.ok(PARTS[hit.bol]?.length, `${name}: missing voice ${hit.bol}`);
    assert.ok(hit.offset >= 0 && hit.offset < .8);
  }
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i].offset > hits[i-1].offset);
  const step = compositionStep(name);
  const composition = {version:1,name,beatsPerCycle:4,steps:fitComposition([step],4)};
  assert.equal(parseComposition(JSON.parse(JSON.stringify(composition))).steps[0].bol,name);
}
assert.deepEqual(bolHits('Terekete',1).map(hit=>hit.offset),[0,.25,.5,.75]);
assert.deepEqual(bolHits('Terekete',2).map(hit=>hit.offset),[0,.5,1,1.5]);
assert.deepEqual(bolHits('Kran',.9).map(hit=>hit.bol),['Ke','Te','Na']);
assert.equal(bolHits('Kre',1)[1].offset,.025);
assert.deepEqual(bolHits('Rest',1),[]);
assert.deepEqual(bolHits('unknown',1),[]);
console.log(`PASS: ${COMPOSITION_BOLS.length} playable bols/aliases/phrases; ${Object.keys(PHRASES).length} sequenced phrases; timing, flam spacing, and export/import validation.`);

assert.deepEqual(bolHits('Kredhit', 1), [{bol:'Ke',offset:0},{bol:'Te',offset:.025},{bol:'Dhit',offset:.5}]);
assert.deepEqual(bolHits('Kredhit', .02).map(hit => hit.offset), [0,.005,.01]);
