import assert from 'node:assert/strict';
import { TablaAudio } from '../lib/tabla.ts';

// Regression: an already-running Safari context may leave redundant resume promises pending.
const warm = new TablaAudio();
let resumes = 0, loads = 0;
warm.context = { state: 'running', resume() {resumes++;return new Promise(()=>{});} };
warm.loaded = true;
warm.load = async () => {loads++;};
const start = performance.now();
assert.equal(warm.unlock(), undefined, 'Warm playback must not await a browser promise');
assert.ok(performance.now()-start < 25);
assert.equal(resumes,0);assert.equal(loads,0);

const cold = new TablaAudio();
let release;
cold.context = {state:'suspended',resume(){resumes++;return new Promise(resolve=>{release=()=>{cold.context.state='running';resolve();};});}};
cold.load = async()=>{loads++;cold.loaded=true;};
const first=cold.unlock(),second=cold.unlock();
assert.equal(first,second,'Concurrent gestures share one startup');
assert.equal(resumes,1);assert.equal(loads,1,'Sample preparation starts alongside resume');
release();await first;
assert.equal(cold.unlock(),undefined,'Next gesture starts synchronously');

const stalled=new TablaAudio();
stalled.context={state:'suspended',resume:()=>new Promise(()=>{})};
stalled.load=async()=>{stalled.loaded=true;};
await assert.rejects(stalled.unlock(),/Audio did not start/);
stalled.context.state='running';
assert.equal(stalled.unlock(),undefined,'A timed-out startup does not permanently block retry');
stalled.closed=true;
assert.throws(()=>stalled.unlock(),/closed/);

// Browsers can close a context after sleep or an output-device change. Rebuild it
// on the next gesture instead of reusing the permanently silent context.
const originalWindow = globalThis.window;
class ReplacementContext {
  state = 'running'; currentTime = 0; destination = {};
  createGain() { return { gain: { value: 0 }, connect() {} }; }
  createDynamicsCompressor() { return { threshold: { value: 0 }, ratio: { value: 0 }, connect() {} }; }
  createMediaStreamDestination() { return { stream: {} }; }
}
globalThis.window = { AudioContext: ReplacementContext };
const externallyClosed = new TablaAudio();
externallyClosed.context = { state: 'closed' };
externallyClosed.loaded = true;
externallyClosed.load = async () => { externallyClosed.loaded = true; };
await externallyClosed.unlock();
assert.ok(externallyClosed.context instanceof ReplacementContext);
globalThis.window = originalWindow;

// Future phrase voices are canceled on Stop; free-play voices are left alone.
const voices=[];
const param={value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}};
const audio=new TablaAudio();
audio.master={};audio.buffers={te:{},ke:{}};
audio.context={currentTime:1,createGain(){return {gain:{...param},connect(){},disconnect(){}};},createBufferSource(){const voice={buffer:null,connect(){},disconnect(){},start(time){this.time=time;},stop(){this.stopped=true;}};voices.push(voice);return voice;}};
audio.play('Terekete',1.01,true,.8,1);
assert.deepEqual(voices.map(voice=>voice.time),[1.01,1.26,1.51,1.76]);
audio.play('Te',1,false);
audio.stopLoop();
assert.ok(voices.slice(0,4).every(voice=>voice.stopped));
assert.equal(voices[4].stopped,undefined);
console.log('PASS: warm/cold startup, timeout retry, externally closed-context rebuild, disposal, and phrase cancellation.');
