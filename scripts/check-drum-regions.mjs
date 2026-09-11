import assert from 'node:assert/strict';
import { DRUM_REGIONS, drumBolAt } from '../lib/drum-regions.ts';

for (const [side, regions] of Object.entries(DRUM_REGIONS)) {
  for (const region of regions) {
    assert.equal(drumBolAt(side, region.x, region.y), region.bol,
      `${side}: clicking the ${region.bol} label must play ${region.bol}`);
  }
  assert.equal(drumBolAt(side, 0, 0), null);
}
assert.equal(drumBolAt('dayan', 0.5, 0.5), 'Te');
assert.equal(drumBolAt('dayan', 0.98, 0.5), 'Na');
assert.equal(drumBolAt('bayan', 0.5, 0.5), 'Ke');
console.log('PASS: every bol marker matches its clickable region; outside-head clicks are ignored.');
