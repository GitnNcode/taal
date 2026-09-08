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
export type Bol = (typeof STROKES)[number]['bol'];
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
export function nextBeat(index: number, count: number) {
  return (index + 1) % count;
}
export function tempoSeconds(bpm: number) {
  return 60 / Math.max(40, Math.min(240, bpm));
}

export class TablaAudio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  destination: MediaStreamAudioDestinationNode | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private loading: Promise<void> | null = null;
  private voices = new Map<AudioScheduledSourceNode, boolean>();
  private closed = false;
  init() {
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
          const response = await fetch(`/audio/${bol}.wav`);
          if (!response.ok)
            throw new Error(
              'The tabla sounds could not load. Check your connection and retry.',
            );
          const buffer = await ctx.decodeAudioData(
            await response.arrayBuffer(),
          );
          if (this.closed) return;
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
        .then(() => undefined)
        .catch((error) => {
          this.loading = null;
          throw error;
        });
    return this.loading;
  }
  async unlock() {
    const ctx = this.init();
    await ctx.resume();
    await this.load();
    if (ctx.state !== 'running')
      throw new Error(
        'Audio is paused by your browser. Tap a stroke to enable sound.',
      );
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
  ) {
    if (!this.context || !this.master || this.closed) return;
    const ctx = this.context;
    const when = Math.max(time, ctx.currentTime);
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
          gain.connect(this.master!);
          this.track(osc, loop, gain);
          osc.start(when);
          osc.stop(when + 1.05);
        });
      } else if (this.buffers[part]) {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = this.buffers[part];
        gain.gain.value = velocity * 0.75;
        source.connect(gain);
        gain.connect(this.master);
        this.track(source, loop, gain);
        source.start(when);
      }
    }
  }
  click(time: number, accent: boolean) {
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.frequency.value = accent ? 1400 : 950;
    gain.gain.setValueAtTime(0.085, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    osc.connect(gain);
    gain.connect(this.master);
    this.track(osc, true, gain);
    osc.start(time);
    osc.stop(time + 0.045);
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
    for (const source of this.voices.keys()) {
      try {
        source.stop();
      } catch {}
    }
    this.voices.clear();
    if (this.context) void this.context.close();
  }
}
