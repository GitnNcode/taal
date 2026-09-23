'use client';

import {
  AudioLines,
  LoaderCircle,
  Minus,
  Play,
  Plus,
  Square,
} from 'lucide-react';
import { MAX_BPM, MIN_BPM, TAALS, type Taal } from '@/lib/tabla';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export default function PracticeControls({
  taal,
  setTaal,
  bpm,
  setBpm,
  metronome,
  setMetronome,
  beat,
  busy,
  ready,
  playing,
  stopLoop,
  onToggleLoop,
}: {
  taal: Taal;
  setTaal: (taal: Taal) => void;
  bpm: number;
  setBpm: (bpm: number) => void;
  metronome: boolean;
  setMetronome: (on: boolean) => void;
  beat: number;
  busy: boolean;
  ready: boolean;
  playing: boolean;
  stopLoop: () => void;
  onToggleLoop: () => void;
}) {
  const pattern = TAALS[taal];
  return (
    <section className="practice-panel">
      <div className="panel-title">
        <h2>Play along</h2>
        <AudioLines size={20} />
      </div>
      <p className="panel-description">A steady rhythm to find your flow.</p>
      <label className="field-label" id="taal-label" htmlFor="taal-select">
        Choose a taal
      </label>
      <Select
        value={taal}
        onValueChange={(v) => {
          if (v && Object.hasOwn(TAALS, v)) {
            stopLoop();
            setTaal(v as Taal);
          }
        }}
      >
        <SelectTrigger
          id="taal-select"
          className="taal-select"
          aria-labelledby="taal-label"
        >
          <SelectValue>
            {pattern.name} · {pattern.beats.length} beats
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="teentaal">Teentaal · 16 beats</SelectItem>
          <SelectItem value="keharwa">Keharwa · 8 beats</SelectItem>
          <SelectItem value="dadra">Dadra · 6 beats</SelectItem>
        </SelectContent>
      </Select>
      <div className="tempo-heading">
        <span>Tempo</span>
        <div className="tempo-number">
          <button
            aria-label="Slower"
            onClick={() => setBpm(Math.max(MIN_BPM, bpm - 5))}
          >
            <Minus size={14} />
          </button>
          <strong>{bpm}</strong>
          <span>BPM</span>
          <button
            aria-label="Faster"
            onClick={() => setBpm(Math.min(MAX_BPM, bpm + 5))}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <Slider
        aria-label="Tempo"
        value={[bpm]}
        min={MIN_BPM}
        max={MAX_BPM}
        onValueChange={(v) => setBpm(Array.isArray(v) ? v[0] : v)}
      />
      <div className="range-labels">
        <span>Slow & steady</span>
        <span>Pick it up</span>
      </div>
      <div className="beat-grid">
        {pattern.beats.map((bol, i) => (
          <div
            key={i}
            className={`beat ${pattern.groups.includes(i) ? 'group-start' : ''} ${beat === i ? 'current' : ''} ${pattern.khali === i ? 'khali' : ''}`}
            aria-current={beat === i ? 'step' : undefined}
            title={`${i + 1}: ${bol}${i === 0 ? ' — sam' : pattern.khali === i ? ' — khali' : ''}`}
          >
            <small>
              {pattern.khali === i ? '○ ' : ''}
              {i + 1}
            </small>
            <strong>{bol}</strong>
          </div>
        ))}
      </div>
      <div className="beat-legend">
        <span>
          <i />
          Sam / first beat
        </span>
        <span>{pattern.beats.length}-beat cycle</span>
      </div>
      <button
        className="primary-button"
        onClick={onToggleLoop}
        disabled={busy || !ready}
        aria-keyshortcuts="Space"
      >
        {busy ? (
          <LoaderCircle size={17} className="audio-loading-spinner" />
        ) : playing ? (
          <Square size={15} fill="currentColor" />
        ) : (
          <Play size={17} fill="currentColor" />
        )}
        {busy ? 'Starting audio…' : playing ? 'Stop rhythm' : 'Start rhythm'}
        <kbd>space</kbd>
      </button>
      <div className="metronome-row">
        <label htmlFor="metronome">Metronome click</label>
        <Switch
          id="metronome"
          checked={metronome}
          onCheckedChange={setMetronome}
        />
      </div>
    </section>
  );
}
