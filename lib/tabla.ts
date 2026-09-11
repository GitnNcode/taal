export const STROKES = [
  { bol: 'Ge', key: 'A', note: 'Open bass' },
  { bol: 'Ke', key: 'S', note: 'Closed bass' },
  { bol: 'Na', key: 'D', note: 'Rim stroke' },
  { bol: 'Tin', key: 'F', note: 'Clear ring' },
  { bol: 'Tun', key: 'G', note: 'Open tone' },
  { bol: 'Te', key: 'H', note: 'Closed tone' },
  { bol: 'Dha', key: 'J', note: 'Both drums' },
  { bol: 'Dhin', key: 'K', note: 'Ringing pair' },
] as const;
export type Bol = (typeof COMPOSITION_BOLS)[number];
export const TAALS = {
  teentaal: {
    name: 'Teentaal',
    beats:
      'Dha Dhin Dhin Dha Dha Dhin Dhin Dha Dha Tin Tin Ta Ta Dhin Dhin Dha'.split(
        ' ',
      ),
    groups: [0, 4, 8, 12],
    khali: 8,
  },
  keharwa: {
    name: 'Keharwa',
    beats: 'Dha Ge Na Ti Na Ka Dhi Na'.split(' '),
    groups: [0, 4],
    khali: 4,
  },
  dadra: {
    name: 'Dadra',
    beats: 'Dha Dhin Na Ta Tin Na'.split(' '),
    groups: [0, 3],
    khali: 3,
  },
};
export type Taal = keyof typeof TAALS;
export const PARTS: Record<string, string[]> = {
  Ge: ['ge'],
  Ke: ['ke'],
  Na: ['na'],
  Tin: ['tin'],
  Tun: ['tun'],
  Te: ['te'],
  Dha: ['ge', 'na'],
  Dhin: ['ge', 'tin'],
  Ta: ['na'],
  Ti: ['te'],
  Ka: ['ke'],
  Dhi: ['ge', 'tin'],
};
// Additional articulations use the nearest available sample, not new recordings.
export const EXTRA_STROKES = {
  Ta: ['na'],
  Ti: ['te'],
  Re: ['te'],
  Ri: ['te'],
  Ra: ['te'],
  Ne: ['te'],
  Ghe: ['ge'],
  Ga: ['ge'],
  Gi: ['ge'],
  Ka: ['ke'],
  Ki: ['ke'],
  Ko: ['ke'],
  Kat: ['ke'],
  Kot: ['ke'],
  Tak: ['te'],
  Tet: ['te'],
  Tu: ['tun'],
  Thun: ['tun'],
  Din: ['tun'],
  Dhi: ['ge', 'tin'],
  Dhe: ['ge', 'te'],
  Dhet: ['ge', 'te'],
  Dhun: ['ge', 'tun'],
  Dhit: ['ge', 'te'],
} as const;
Object.assign(PARTS, EXTRA_STROKES);
export const PHRASES = {
  Terekete: ['Te', 'Re', 'Ke', 'Te'],
  Tirakita: ['Ti', 'Ra', 'Ki', 'Ta'],
  Tirkit: ['Ti', 'Ra', 'Ki', 'Ta'],
  Tetekete: ['Te', 'Te', 'Ke', 'Te'],
  Tite: ['Ti', 'Te'],
  Tete: ['Te', 'Te'],
  Tita: ['Ti', 'Ta'],
  Kita: ['Ki', 'Ta'],
  Kete: ['Ke', 'Te'],
  Taka: ['Ta', 'Ka'],
  Dhage: ['Dha', 'Ge'],
  Dhati: ['Dha', 'Ti'],
  Dhagena: ['Dha', 'Ge', 'Na'],
  Dhatigena: ['Dha', 'Ti', 'Ge', 'Na'],
  Dhatidhage: ['Dha', 'Ti', 'Dha', 'Ge'],
  Dhatirakita: ['Dha', 'Ti', 'Ra', 'Ki', 'Ta'],
  Tirakitataka: ['Ti', 'Ra', 'Ki', 'Ta', 'Ta', 'Ka'],
  Dhinna: ['Dhin', 'Na'],
  Tinna: ['Tin', 'Na'],
  Tunna: ['Tun', 'Na'],
  Gadigena: ['Ga', 'Di', 'Ge', 'Na'],
  Digidigi: ['Di', 'Gi', 'Di', 'Gi'],
  Dhadha: ['Dha', 'Dha'],
  Kre: ['Ke', 'Te'],
  Kra: ['Ke', 'Te'],
  // Sample approximation: a Kre flam followed by Dhit.
  Kredhit: ['Ke', 'Te', 'Dhit'],
  // User-requested spelling; this editable-composition approximation is not a universal fingering.
  Kran: ['Ke', 'Te', 'Na'],
} as const;
PARTS.Di = ['te'];
export const COMPOSITION_BOLS = [
  ...STROKES.map((stroke) => stroke.bol),
  ...(Object.keys(EXTRA_STROKES) as (keyof typeof EXTRA_STROKES)[]),
  'Di',
  ...(Object.keys(PHRASES) as (keyof typeof PHRASES)[]),
] as const;
export function bolHits(bol: string, durationSeconds: number) {
  const phrase = PHRASES[bol as keyof typeof PHRASES];
  if (!phrase) return PARTS[bol] ? [{ bol, offset: 0 }] : [];
  const span = Math.max(0.001, durationSeconds);
  return phrase.map((stroke, index) => ({
    bol: stroke,
    offset:
      bol === 'Kredhit'
        ? index === 2
          ? span / 2
          : index * Math.min(0.025, span / 4)
        : bol === 'Kre' || bol === 'Kra'
          ? index * Math.min(0.025, span / phrase.length)
          : (index * span) / phrase.length,
  }));
}
export function bolDescription(bol: string) {
  if (bol === 'Rest') return 'Silence for the selected duration';
  if (bol === 'Kredhit')
    return 'Sample approximation: Kre flam → Dhit within the selected duration';
  if (bol === 'Kran')
    return 'Approximation: Ke → Te → Na; articulation varies by tradition';
  if (bol === 'Kre' || bol === 'Kra')
    return 'Ke + Te flam (closely spaced strokes)';
  const phrase = PHRASES[bol as keyof typeof PHRASES];
  if (phrase) return phrase.join(' → ') + ' within the selected duration';
  return bol in EXTRA_STROKES || bol === 'Di'
    ? 'Sample-based approximation of this articulation'
    : 'Core tabla stroke';
}
export function nextBeat(index: number, count: number) {
  return (index + 1) % count;
}
export const MIN_BPM = 40;
export const MAX_BPM = 600;

export function tempoSeconds(bpm: number) {
  return 60 / Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
}

// Drive visuals from the sample frame at the output device, not the render-ahead clock.
// Browsers disagree about what getOutputTimestamp() means: Chrome and Firefox
// report the frame leaving the device, Safari reports the frame leaving the
// renderer. Whichever estimate says the sound is further behind is the one that
// accounts for more of the real hardware path, so take the earlier of the two.
export function audibleContextTime(
  ctx: Pick<
    AudioContext,
    'currentTime' | 'state' | 'baseLatency' | 'outputLatency'
  > & { getOutputTimestamp?: () => AudioTimestamp },
  now = performance.now(),
): number {
  if (ctx.state !== 'running') return -Infinity;
  // Compressor look-ahead adds a fixed 6 ms.
  const fromLatency =
    ctx.currentTime -
    Math.max(0, ctx.baseLatency || 0) -
    Math.max(0, ctx.outputLatency || 0) -
    0.006;
  if (typeof ctx.getOutputTimestamp === 'function') {
    const stamp = ctx.getOutputTimestamp();
    if (
      Number.isFinite(stamp.contextTime) &&
      Number.isFinite(stamp.performanceTime)
    ) {
      // A zero timestamp means output has not begun yet. Do not advance the playhead.
      if (stamp.performanceTime === 0) return -Infinity;
      // The timestamp describes a past output frame. Project it onto this
      // display frame, but stop extrapolating if the device stops reporting.
      const elapsed = Math.max(0, Math.min(0.05, (now - stamp.performanceTime!) / 1000));
      const fromStamp = Math.min(ctx.currentTime, stamp.contextTime! + elapsed) - 0.006;
      return Math.min(fromStamp, fromLatency);
    }
  }
  return fromLatency;
}

export class TablaAudio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  destination: MediaStreamAudioDestinationNode | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private loading: Promise<void> | null = null;
  private loaded = false;
  private resuming: Promise<void> | null = null;
  private voices = new Map<AudioScheduledSourceNode, boolean>();
  private closed = false;
  private compiled = new Map<string, Promise<CompiledTrack>>();
  private discardExternallyClosedContext() {
    if (this.context?.state !== 'closed') return;
    this.context = null;
    this.master = null;
    this.destination = null;
    this.buffers = {};
    this.loading = null;
    this.loaded = false;
    this.resuming = null;
    this.voices.clear();
  }
  init() {
    this.discardExternallyClosedContext();
    if (!this.context) {
      const Constructor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Constructor)
        throw new Error(
          'This browser cannot play Web Audio. Try a recent Chrome, Safari, or Firefox.',
        );
      this.context = new Constructor({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.master.gain.value = 0.75;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -5;
      compressor.ratio.value = 8;
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
      this.destination = this.context.createMediaStreamDestination();
      compressor.connect(this.destination);
    }
    return this.context;
  }
  async load() {
    const ctx = this.init();
    if (!this.loading)
      this.loading = Promise.all(
        ['na', 'tun', 'te', 'ge', 'ke'].map(async (bol) => {
          if (this.buffers[bol]) return;
          const response = await fetch(`/audio/${bol}.wav`, {
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok)
            throw new Error(
              'The tabla sounds could not load. Check your connection and retry.',
            );
          const buffer = await ctx.decodeAudioData(
            await response.arrayBuffer(),
          );
          if (this.closed || this.context !== ctx) return;
          // Normalize the recorded strokes so short closed bols remain audible.
          let peak = 0;
          for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const samples = buffer.getChannelData(channel);
            for (const sample of samples)
              peak = Math.max(peak, Math.abs(sample));
          }
          if (peak > 0)
            for (
              let channel = 0;
              channel < buffer.numberOfChannels;
              channel++
            ) {
              const samples = buffer.getChannelData(channel);
              for (let i = 0; i < samples.length; i++)
                samples[i] *= 0.72 / peak;
            }
          this.buffers[bol] = buffer;
        }),
      )
        .then(() => {
          if (this.context === ctx) this.loaded = !this.closed;
        })
        .catch((error) => {
          if (this.context === ctx) this.loading = null;
          throw error;
        });
    return this.loading;
  }
  unlock(): Promise<void> | undefined {
    if (this.closed)
      throw new Error('Audio has been closed. Reload the studio.');
    const ctx = this.init();
    // Safari may defer resume() promises; never call it for an already-running context.
    if (ctx.state === 'running' && this.loaded) return;
    if (this.resuming) return this.resuming;
    const resume = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
    let timeout: ReturnType<typeof setTimeout>;
    this.resuming = Promise.race([
      Promise.all([resume, this.load()]).then(() => {
        if (ctx.state !== 'running')
          throw new Error('Audio is paused. Tap Play again to enable sound.');
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                'Audio did not start. Tap Play again to reconnect it.',
              ),
            ),
          3000,
        );
      }),
    ]).finally(() => {
      clearTimeout(timeout);
      this.resuming = null;
    });
    return this.resuming;
  }
  volume(value: number) {
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        value / 100,
        this.context.currentTime,
        0.015,
      );
  }
  private track(node: AudioScheduledSourceNode, loop: boolean, gain: GainNode) {
    this.voices.set(node, loop);
    node.onended = () => {
      this.voices.delete(node);
      node.disconnect();
      gain.disconnect();
    };
  }
  play(
    bol: string,
    time = this.context?.currentTime ?? 0,
    loop = false,
    velocity = 1,
    durationSeconds = 2 / 3,
  ) {
    if (!this.context || !this.master || this.closed) return;
    this.renderBol(this.context, this.master, bol, time, velocity, durationSeconds, loop);
  }
  private renderBol(ctx: BaseAudioContext, output: AudioNode, bol: string,
    time: number, velocity: number, durationSeconds: number, loop: boolean | null) {
    const when = Math.max(time, ctx.currentTime);
    if (bol in PHRASES) {
      const hits = bolHits(bol, durationSeconds);
      for (const [index, hit] of hits.entries()) {
        // Te and Re share a recording. A lighter Re and balanced Ke keep
        // Terekete from sounding like four equally accented attacks.
        const accent = bol === 'Terekete' ? [1, 0.6, 0.75, 0.9][index] : 1;
        const end = hits[index + 1]?.offset ?? Math.max(0.001, durationSeconds);
        this.renderBol(ctx, output, hit.bol, when + hit.offset, velocity * accent, end - hit.offset, loop);
      }
      return;
    }
    for (const part of PARTS[bol] || []) {
      if (part === 'tin') {
        // Modeled Tin: tuned membrane partials, explicitly identified in the sound notes.
        [1, 2, 3, 4.12, 5.4].forEach((ratio, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = 295 * ratio;
          const level = (0.17 * velocity) / (1 + i * 1.7);
          gain.gain.setValueAtTime(0.0001, when);
          gain.gain.exponentialRampToValueAtTime(level, when + 0.002);
          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            when + 0.95 / (1 + i * 0.4),
          );
          osc.connect(gain);
          gain.connect(output);
          if (loop !== null) this.track(osc, loop, gain);
          osc.start(when);
          osc.stop(when + 1.05);
        });
      } else if (this.buffers[part]) {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = this.buffers[part];
        gain.gain.value = velocity * 0.75;
        source.connect(gain);
        gain.connect(output);
        if (loop !== null) this.track(source, loop, gain);
        if (part === 'te' || part === 'ke') {
          // Closed strokes must release inside their slot, including the last
          // stroke of a phrase. Fade rather than cut the waveform abruptly.
          const span = Math.max(0.001, durationSeconds);
          const end = when + span;
          gain.gain.setValueAtTime(velocity * 0.75, when);
          gain.gain.setValueAtTime(velocity * 0.75, end - Math.min(0.005, span / 4));
          gain.gain.linearRampToValueAtTime(0, end);
          source.start(when, 0, span);
        } else source.start(when);
      }
    }
  }
  click(time: number, accent: boolean) {
    if (!this.context || !this.master) return;
    this.renderClick(this.context, this.master, time, accent, true);
  }
  private renderClick(ctx: BaseAudioContext, output: AudioNode, time: number, accent: boolean, loop: boolean | null) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1400 : 950;
    gain.gain.setValueAtTime(0.085, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    osc.connect(gain);
    gain.connect(output);
    if (loop !== null) this.track(osc, loop, gain);
    osc.start(time);
    osc.stop(time + 0.045);
  }
  compile(composition: Composition, bpm: number, metronome: boolean): Promise<CompiledTrack> {
    const key = JSON.stringify([bpm, metronome, composition.beatsPerCycle,
      composition.steps.map(({ bol, units, emphasis }) => [bol, units, emphasis])]);
    const cached = this.compiled.get(key);
    if (cached) return cached;
    const rendering = this.renderTrack(composition, bpm, metronome);
    this.compiled.set(key, rendering);
    // Keep the current composition and practice rhythm, not every edit.
    if (this.compiled.size > 2) this.compiled.delete(this.compiled.keys().next().value!);
    void rendering.catch(() => { if (this.compiled.get(key) === rendering) this.compiled.delete(key); });
    return rendering;
  }
  private async renderTrack(composition: Composition, bpm: number, metronome: boolean): Promise<CompiledTrack> {
    await this.load();
    if (this.closed) throw new Error('Audio restarted. Tap Play again.');
    const units = compositionUnits(composition.steps);
    const sampleRate = this.context!.sampleRate;
    const frames = Math.max(1, Math.round(units * tempoSeconds(bpm) / 4 * sampleRate));
    const duration = frames / sampleRate;
    const secondsPerUnit = duration / units;
    // Render enough repeats for all ringing tails to reach steady state. The
    // first pass starts clean; the final pass is the seamless native loop.
    const tail = Math.max(1.05, ...Object.values(this.buffers).map(buffer => buffer.duration));
    const repeats = Math.ceil(tail / duration) + 1;
    const offline = new OfflineAudioContext(1, frames * repeats, sampleRate);
    const events = compositionTimeline(composition);
    const hits = events.flatMap(event => bolHits(event.bol ?? 'Rest', event.units * secondsPerUnit)
      .map(hit => ({ bol: hit.bol, time: event.start * secondsPerUnit + hit.offset })));
    for (let cycle = 0; cycle < repeats; cycle++) {
      const origin = cycle * duration;
      for (const event of events) {
        if (event.bol && event.bol !== 'Rest')
          this.renderBol(offline, offline.destination, event.bol,
            origin + event.start * secondsPerUnit, event.emphasis,
            event.units * secondsPerUnit, null);
      }
      if (metronome) for (let unit = 0; unit < units; unit += 4)
        this.renderClick(offline, offline.destination, origin + unit * secondsPerUnit,
          unit % (composition.beatsPerCycle * 4) === 0, null);
    }
    const buffer = await offline.startRendering();
    return { buffer, units, secondsPerUnit, duration, loopStart: (repeats - 1) * duration, hits };
  }
  startCompiled(track: CompiledTrack, when: number, offsetUnits = 0): AudioBufferSourceNode {
    if (!this.context || !this.master || this.closed) throw new Error('Audio is not ready.');
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = track.buffer;
    source.loop = true;
    source.loopStart = track.loopStart;
    source.loopEnd = track.buffer.duration;
    source.connect(gain);
    gain.connect(this.master);
    this.track(source, true, gain);
    source.start(when, (offsetUnits % track.units) * track.secondsPerUnit);
    return source;
  }
  stopLoop() {
    for (const [source, loop] of this.voices)
      if (loop) {
        try {
          source.stop();
        } catch {}
        this.voices.delete(source);
      }
  }
  dispose() {
    this.closed = true;
    this.compiled.clear();
    for (const source of this.voices.keys()) {
      try {
        source.stop();
      } catch {}
    }
    this.voices.clear();
    if (this.context) void this.context.close();
  }
}

export type CompiledTrack = {
  buffer: AudioBuffer;
  units: number;
  secondsPerUnit: number;
  duration: number;
  loopStart: number;
  hits: { bol: string; time: number }[];
};
export type TrackPlayback = {
  track: CompiledTrack;
  source: AudioBufferSourceNode;
  when: number;
  offsetUnits: number;
};
export function trackPosition(playback: TrackPlayback, time: number) {
  return playback.offsetUnits + Math.max(0, time - playback.when) / playback.track.secondsPerUnit;
}
export function practiceComposition(taal: Taal): Composition {
  return { version: 1, name: TAALS[taal].name, beatsPerCycle: TAALS[taal].beats.length,
    steps: TAALS[taal].beats.map((bol, index) => ({ id: String(index), bol: bol as Bol, units: 4, emphasis: index === 0 ? 0.85 : 0.68 })) };
}

// Composition timing uses quarter-beat units so fractional durations remain exact.
export type CompositionStep = {
  id: string;
  bol: Bol | 'Rest' | null;
  units: number;
  emphasis: number;
};
export type Composition = {
  version: 1;
  name: string;
  beatsPerCycle: number;
  steps: CompositionStep[];
};
export const compositionUnits = (steps: CompositionStep[]) =>
  steps.reduce((sum, step) => sum + step.units, 0);
export function compositionStep(
  bol: CompositionStep['bol'] = null,
  units = 4,
): CompositionStep {
  return { id: crypto.randomUUID(), bol, units, emphasis: 0.8 };
}
export function formatBolScript(steps: CompositionStep[]): string {
  const meaningful = [...steps];
  while (meaningful.at(-1)?.bol === null) meaningful.pop();
  return meaningful
    .map((step) => {
      const bol = step.bol ?? 'Rest';
      const length = step.units === 4 ? '' : `(${step.units / 4})`;
      const percent = Number((step.emphasis * 100).toFixed(4));
      const emphasis = percent === 80 ? '' : `[${percent}]`;
      return `${bol}${length}${emphasis}`;
    })
    .join(', ');
}
export function parseBolScript(text: string): CompositionStep[] {
  const tokens = text
    .split(/[,\n]/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens.length)
    throw new Error('Write at least one bol, separated by commas.');
  if (tokens.length > 4096)
    throw new Error('Use at most 4,096 bols at a time.');
  const names = new Map<string, CompositionStep['bol']>(
    [...COMPOSITION_BOLS, 'Rest' as const].map((bol) => [
      bol.toLowerCase(),
      bol,
    ]),
  );
  names.set('pause', 'Rest');
  names.set('-', 'Rest');
  const parsed = tokens.map((token) => {
    const match =
      /^([^()[\]]+?)(?:\(\s*(\d+(?:\.\d+)?|\.\d+)\s*\))?(?:\[\s*(\d+(?:\.\d+)?|\.\d+)\s*\])?$/.exec(
        token,
      );
    if (!match)
      throw new Error(
        `Could not read “${token}”. Try a bol, bol(length), or bol(length)[emphasis], such as Terekete(2)[90].`,
      );
    const beats = match[2] === undefined ? 1 : Number(match[2]);
    if (beats < 0.25 || beats > 4096 || !Number.isInteger(beats * 4))
      throw new Error(
        `The length in “${token}” must be 0.25–4,096 beats, in quarter-beat steps.`,
      );
    const percent = match[3] === undefined ? 80 : Number(match[3]);
    if (percent < 20 || percent > 125)
      throw new Error(
        `The emphasis in “${token}” must be a number from 20–125, without a % sign.`,
      );
    return {
      name: match[1].trim(),
      units: beats * 4,
      emphasis: percent / 100,
    };
  });
  const unknown = [
    ...new Set(
      parsed
        .filter(({ name }) => !names.has(name.toLowerCase()))
        .map(({ name }) => name),
    ),
  ];
  if (unknown.length)
    throw new Error(
      `Unknown bols: ${unknown.slice(0, 8).join(', ')}. Check the bol library for spellings.`,
    );
  return parsed.map(({ name, units, emphasis }) => ({
    ...compositionStep(names.get(name.toLowerCase())!, units),
    emphasis,
  }));
}
export function fitComposition(
  steps: CompositionStep[],
  beats: number,
  minimumUnits = beats * 4,
): CompositionStep[] {
  if (!Number.isInteger(beats) || beats < 1 || beats > 64)
    throw new Error('Choose 1–64 beats per cycle.');
  const result = steps.map((step) => ({ ...step }));
  while (result.length && result.at(-1)!.bol === null) result.pop();
  let used = compositionUnits(result);
  const capacity = Math.max(
    beats * 4,
    Math.ceil(Math.max(used, minimumUnits) / (beats * 4)) * beats * 4,
  );
  if (capacity > 16384)
    throw new Error(
      'This composition is full (4,096 beats). Export it and start another.',
    );
  while (used < capacity) {
    const units = Math.min(4 - (used % 4), capacity - used);
    result.push(compositionStep(null, units));
    used += units;
  }
  return result;
}
export function newComposition(): Composition {
  return {
    version: 1,
    name: 'My composition',
    beatsPerCycle: 16,
    steps: fitComposition([], 16),
  };
}
export function placeCompositionStep(
  composition: Composition,
  targetId: string,
  source: { id: string } | { bol: CompositionStep['bol'] },
): Composition {
  if ('id' in source && source.id === targetId) return composition;
  let steps = composition.steps.map((step) => ({ ...step }));
  const step =
    'id' in source
      ? steps.find((step) => step.id === source.id)
      : compositionStep(source.bol);
  if (!step || !steps.some((step) => step.id === targetId)) return composition;
  if ('id' in source) steps = steps.filter((step) => step.id !== source.id);
  const target = steps.findIndex((step) => step.id === targetId);
  if (target < 0) return composition;
  if (steps[target].bol === null) {
    const remaining = steps[target].units - step.units;
    steps.splice(
      target,
      1,
      step,
      ...(remaining > 0 ? [compositionStep(null, remaining)] : []),
    );
  } else steps.splice(target, 0, step);
  return {
    ...composition,
    steps: fitComposition(
      steps,
      composition.beatsPerCycle,
      compositionUnits(composition.steps),
    ),
  };
}
export function changeCompositionStep(
  composition: Composition,
  id: string,
  patch: Partial<Pick<CompositionStep, 'bol' | 'units' | 'emphasis'>>,
): Composition {
  if (
    patch.units !== undefined &&
    (!Number.isInteger(patch.units) || patch.units < 1 || patch.units > 256)
  )
    throw new Error('Duration must be between ¼ and 64 beats.');
  if (
    patch.emphasis !== undefined &&
    (!Number.isFinite(patch.emphasis) ||
      patch.emphasis < 0.2 ||
      patch.emphasis > 1.25)
  )
    throw new Error('Emphasis must be between 20% and 125%.');
  const steps = composition.steps.map((step) =>
    step.id === id ? { ...step, ...patch } : step,
  );
  return {
    ...composition,
    steps: fitComposition(
      steps,
      composition.beatsPerCycle,
      compositionUnits(composition.steps),
    ),
  };
}
export function resizeComposition(
  composition: Composition,
  beats: number,
): Composition {
  const cycles =
    compositionUnits(composition.steps) / (composition.beatsPerCycle * 4);
  return {
    ...composition,
    beatsPerCycle: beats,
    steps: fitComposition(composition.steps, beats, cycles * beats * 4),
  };
}
export function compositionTimeline(composition: Composition) {
  let start = 0;
  return composition.steps.map((step) => {
    const event = { ...step, start };
    start += step.units;
    return event;
  });
}
export function parseComposition(value: unknown): Composition {
  const data = value as Composition;
  const allowed = new Set<string | null>([...COMPOSITION_BOLS, 'Rest', null]);
  if (
    !data ||
    data.version !== 1 ||
    typeof data.name !== 'string' ||
    data.name.length > 100 ||
    !Number.isInteger(data.beatsPerCycle) ||
    data.beatsPerCycle < 1 ||
    data.beatsPerCycle > 64 ||
    !Array.isArray(data.steps) ||
    !data.steps.length ||
    data.steps.length > 16384
  )
    throw new Error('Choose a valid Taal composition file.');
  for (const step of data.steps) {
    if (
      !step ||
      !allowed.has(step.bol) ||
      !Number.isInteger(step.units) ||
      step.units < 1 ||
      step.units > 256 ||
      !Number.isFinite(step.emphasis) ||
      step.emphasis < 0.2 ||
      step.emphasis > 1.25
    )
      throw new Error(
        'The composition contains an invalid bol, duration, or emphasis.',
      );
  }
  const units = compositionUnits(data.steps);
  if (units > 16384 || units % (data.beatsPerCycle * 4) !== 0)
    throw new Error('The composition must contain complete cycles.');
  return {
    version: 1,
    name: data.name,
    beatsPerCycle: data.beatsPerCycle,
    steps: data.steps.map((step) => ({
      id: crypto.randomUUID(),
      bol: step.bol,
      units: step.units,
      emphasis: step.emphasis,
    })),
  };
}

// Keep the v1 composition shape so existing drafts and exports still open.
export function parseCompositionDraft(value: unknown) {
  const composition = parseComposition(value);
  const data = value as { bpm?: unknown; script?: unknown };
  const bpm = typeof data.bpm === 'number' && Number.isInteger(data.bpm) &&
    data.bpm >= MIN_BPM && data.bpm <= MAX_BPM ? data.bpm : 90;
  const script = typeof data.script === 'string' && data.script.length <= 100_000
    ? data.script : formatBolScript(composition.steps);
  return { composition, bpm, script };
}
