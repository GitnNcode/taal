import assert from 'node:assert/strict';
import { TablaAudio, practiceComposition } from '../lib/tabla.ts';

const renders = [], voices = [];
class OfflineContext {
  currentTime = 0; destination = {};
  constructor(channels, frames, sampleRate) { Object.assign(this, {channels, frames, sampleRate}); renders.push(this); }
  createGain() { return { gain: {value: 1, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}}, connect(){}, disconnect(){} }; }
  createBufferSource() {
    const voice = { connect(){}, disconnect(){}, start(...args){this.started=args;}, stop(time){this.stopCalled=true;this.stopped=time;} };
    voices.push(voice); return voice;
  }
  createOscillator() { return {...this.createBufferSource(), frequency: {value: 0}}; }
  async startRendering() { return { duration: this.frames / this.sampleRate }; }
}
globalThis.OfflineAudioContext = OfflineContext;
const audio = new TablaAudio();
audio.context = new OfflineContext(1, 1, 44100);
audio.master = {};
audio.buffers = Object.fromEntries(['na','ge','te','ke','tun'].map(name => [name, {duration:.2}]));
audio.load = async () => {};
const composition = practiceComposition('teentaal');
const first = audio.compile(composition, 90, false);
assert.equal(audio.compile({...composition, name:'Renamed'},90,false), first, 'Renames reuse the ready audio');
const track = await first;
assert.equal(renders.length, 2, 'Only one offline render for repeated requests');
assert.equal(track.units, 64);
assert.equal(track.hits[0].time, 0, 'No count-in or leading silent beats');
assert.ok(Math.abs(track.duration - 16 * 60 / 90) < 1 / 44100);
assert.ok(Math.abs(track.buffer.duration - track.loopStart - track.duration) < 1e-9, 'Native repeat spans exactly one composition');
const liveStartCount = voices.length;
const source = audio.startCompiled(track, 10, 4);
assert.equal(voices.length, liveStartCount + 1, 'Entire composition starts with one native audio source');
assert.equal(source.loop, true);
assert.deepEqual(source.started, [10, 4 * track.secondsPerUnit]);
assert.equal(source.loopStart, track.loopStart);
assert.equal(source.loopEnd, track.buffer.duration);
assert.notEqual(audio.compile(composition,120,false), first, 'Tempo changes rebuild audio');
assert.notEqual(audio.compile(composition,90,true), first, 'Metronome changes rebuild audio');
audio.stopLoop();
assert.equal(source.stopCalled, true);
assert.equal(source.stopped, undefined); // stop() has no scheduled time: stop immediately.
await Promise.all([...audio.compiled.values()]);
console.log('PASS: cached full-track rendering, exact loop length, no leading count-in, one native source, tempo/metronome rebuilds.');
