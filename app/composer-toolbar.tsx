'use client';

import { useState } from 'react';
import {
  Circle,
  LoaderCircle,
  Minus,
  Play,
  Plus,
  Square,
  Undo2,
} from 'lucide-react';
import { MAX_BPM, MIN_BPM } from '@/lib/tabla';

export default function ComposerToolbar({
  name,
  setName,
  cycleInput,
  setCycleInput,
  onCommitCycle,
  bpm,
  setBpm,
  canUndo,
  onUndo,
  audioReady,
  playing,
  hasNotes,
  onPlay,
  onStop,
  recording,
  onRecord,
}: {
  name: string;
  setName: (name: string) => void;
  cycleInput: string;
  setCycleInput: (value: string) => void;
  onCommitCycle: (beats: number) => void;
  bpm: number;
  setBpm: (value: number) => void;
  canUndo: boolean;
  onUndo: () => void;
  audioReady: boolean;
  playing: boolean;
  hasNotes: boolean;
  onPlay: () => Promise<void>;
  onStop: () => void;
  recording: boolean;
  onRecord: () => void;
}) {
  const [starting, setStarting] = useState(false);
  return (
    <div className="composition-toolbar">
      <label className="composition-name">
        Composition name
        <input
          maxLength={100}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
      </label>
      <label className="cycle-input">
        Beats per cycle
        <input
          aria-label="Beats per cycle"
          type="number"
          min={1}
          max={64}
          value={cycleInput}
          onChange={(e) => setCycleInput(e.target.value)}
          onBlur={() => onCommitCycle(Number(cycleInput))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </label>
      <div className="composer-tempo">
        <span>Tempo</span>
        <div>
          <button
            aria-label="Decrease composition tempo"
            onClick={() => setBpm(Math.max(MIN_BPM, bpm - 5))}
          >
            <Minus size={15} />
          </button>
          <strong>{bpm}</strong>
          <span>BPM</span>
          <button
            aria-label="Increase composition tempo"
            onClick={() => setBpm(Math.min(MAX_BPM, bpm + 5))}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
      <div className="composer-actions">
        <button
          className="secondary-button"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Undo2 size={15} />
          Undo
        </button>
        <button
          className="primary-button composition-play"
          disabled={!audioReady || starting || (!hasNotes && !playing)}
          onClick={async () => {
            if (playing) {
              onStop();
              return;
            }
            setStarting(true);
            try {
              await onPlay();
            } finally {
              setStarting(false);
            }
          }}
        >
          {starting ? (
            <LoaderCircle size={15} className="audio-loading-spinner" />
          ) : playing ? (
            <Square size={15} fill="currentColor" />
          ) : (
            <Play size={15} fill="currentColor" />
          )}
          {starting
            ? 'Starting audio…'
            : playing
              ? 'Stop composition'
              : 'Play composition'}
        </button>
        <button
          className={`secondary-button ${recording ? 'recording' : ''}`}
          onClick={onRecord}
        >
          <Circle size={13} fill="currentColor" />
          {recording ? 'Stop recording' : 'Record'}
        </button>
      </div>
    </div>
  );
}
