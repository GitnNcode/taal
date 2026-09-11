import assert from 'node:assert/strict';
import { TablaAudio } from '../lib/tabla.ts';

// Exercise the shared audio path used by both preview and composition playback.
const audio = new TablaAudio();
const voices = [];
audio.master = {};
audio.buffers = { te: { name: 'te' }, ke: { name: 'ke' }, na: { name: 'na' } };
audio.context = {
  currentTime: 0,
  createGain() {
    return { gain: {
      value: 0,
      setValueAtTime(value, time) { this.releaseStart = time; },
      linearRampToValueAtTime(value, time) { this.release = { value, time }; },
    }, connect() {}, disconnect() {} };
  },
  createBufferSource() {
    const voice = {
      connect(gain) { this.gain = gain; },
      disconnect() {},
      start(time, offset, duration) { this.time = time; this.duration = duration; },
      stop() { this.stopped = true; },
    };
    voices.push(voice);
    return voice;
  },
};
for (const loop of [false, true]) {
  for (const duration of [0.025, 0.1, 2 / 3, 1, 2]) {
    for (const emphasis of [0, 0.8, 1.2]) {
      voices.length = 0;
      audio.play('Terekete', 1, loop, emphasis, duration);
      assert.deepEqual(voices.map(v => v.buffer.name), ['te', 'te', 'ke', 'te']);
      assert.deepEqual(voices.map(v => v.time), [0, 1, 2, 3].map(i => 1 + i * duration / 4));
      for (const [index, voice] of voices.entries()) {
        const boundary = voices[index + 1]?.time ?? 1 + duration;
        assert.ok(Math.abs(voice.time + voice.duration - boundary) < 1e-10, 'Closed sample must end at the next stroke or bol');
        assert.equal(voice.gain.gain.release.value, 0, 'Fade to silence to avoid clicks');
        assert.ok(Math.abs(voice.gain.gain.release.time - boundary) < 1e-10);
        assert.ok(voice.gain.gain.releaseStart >= voice.time && voice.gain.gain.releaseStart < boundary);
      }
      const levels = voices.map(v => v.gain.gain.value);
      assert.ok(levels.every(level => Number.isFinite(level) && level >= 0));
      if (emphasis) {
        assert.ok(levels[1] < levels[2] && levels[2] < levels[3] && levels[3] < levels[0], 'Inner strokes should be lighter; final Te must remain clear');
        assert.equal(levels[0], emphasis * 0.75, 'Keep the leading stroke and user emphasis');
      } else assert.ok(levels.every(level => level === 0));
      audio.stopLoop();
      assert.ok(voices.every(v => Boolean(v.stopped) === loop));
      for (const voice of voices) voice.onended();
    }
  }
}
voices.length = 0;
audio.play('Tete', 1, false, 0.8, 1);
assert.deepEqual(voices.map(v => v.gain.gain.value), [0.8 * 0.75, 0.8 * 0.75], 'Other phrases retain their existing dynamics');
voices.length = 0;
audio.play('Na', 2, true, 0.8, 0.025);
assert.equal(voices[0].duration, undefined, 'Open strokes retain their natural ring');
assert.equal(voices[0].gain.gain.release, undefined);
console.log('PASS: Terekete dynamics, attack timing, sample cutoffs and fades through 600 BPM subdivisions, emphasis, preview, loop cancellation, and neighbouring phrase dynamics.');
