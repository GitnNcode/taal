'use client';

import {
  ArrowUpRight,
  AudioLines,
  Headphones,
  Keyboard,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import CompositionMaker from './composition-maker';
import Drums from './drums';
import PracticeControls from './practice-controls';
import RecordPanel from './record-panel';
import StudioNotes from './studio-notes';
import { useModelContextTool } from './use-model-context-tool';
import { useRecorder } from './use-recorder';
import { useTablaAudio } from './use-tabla-audio';

export default function Home() {
  const audio = useTablaAudio({
    stopRecording: () => recorder.stopRecording(),
    pending: () => recorder.pending(),
  });
  const recorder = useRecorder(audio);
  useModelContextTool(audio.applyPracticeConfig);
  const {
    active,
    audioTiming,
    beat,
    bpm,
    busy,
    compositionPlaying,
    compositionPosition,
    error,
    metronome,
    playing,
    ready,
    resetAudio,
    retrySounds,
    setBpm,
    setDraftComposition,
    setMetronome,
    setTaal,
    setVolume,
    stopLoop,
    strike,
    taal,
    toggleLoop,
    volume,
  } = audio;
  return (
    <div className="studio-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Taal home">
          <AudioLines />
          <span>
            taal<span className="brand-dot">.</span>
          </span>
        </a>
        <nav>
          <span className="nav-active">Tabla studio</span>
          <a href="#compose">Compose</a>
          <a href="#guide">
            How to play <ArrowUpRight size={14} />
          </a>
        </nav>
        <div className="header-note">
          <Headphones size={16} /> A little better with headphones
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <h1>Find your rhythm.</h1>
            <p>A tabla, a little curiosity, and you. Let’s play.</p>
          </div>
          <div className="volume-control">
            <button
              className="mute-button"
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              onClick={() => setVolume(volume === 0 ? 75 : 0)}
            >
              {volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
            <Slider
              aria-label="Master volume"
              value={[volume]}
              onValueChange={(v) => setVolume(Array.isArray(v) ? v[0] : v)}
            />
            <span>{volume}%</span>
            <button
              className="secondary-button"
              disabled={busy || recorder.recording}
              onClick={resetAudio}
            >
              Reset audio &amp; test
            </button>
          </div>
        </div>
        {error && (
          <div className="audio-error" role="alert">
            {error} <button onClick={retrySounds}>Retry sounds</button>
          </div>
        )}
        <section className="guide-strip" id="guide">
          <div className="guide-symbol">
            <Keyboard size={22} />
          </div>
          <div>
            <h2>Your keyboard is your instrument.</h2>
            <p>
              Try <kbd>J</kbd> <kbd>F</kbd> <kbd>F</kbd> <kbd>D</kbd> for Dha,
              Tin, Tin, Na. Then follow your ears.
            </p>
          </div>
          <span className="guide-aside">
            No right way to begin.
            <br />
            Just a first beat.
          </span>
        </section>
        <div className="workspace">
          <Drums active={active} strike={strike} />
          <aside className="practice-sidebar">
            <PracticeControls
              taal={taal}
              setTaal={setTaal}
              bpm={bpm}
              setBpm={setBpm}
              metronome={metronome}
              setMetronome={setMetronome}
              beat={beat}
              busy={busy}
              ready={ready}
              playing={playing}
              stopLoop={stopLoop}
              onToggleLoop={() => void toggleLoop()}
            />
            <RecordPanel
              recording={recorder.recording}
              seconds={recorder.seconds}
              canRecord={recorder.canRecord}
              recordUrl={recorder.recordUrl}
              recordExt={recorder.recordExt}
              onToggleRecording={() => void recorder.toggleRecording()}
            />
          </aside>
        </div>
        <CompositionMaker
          audioReady={ready}
          bpm={bpm}
          setBpm={setBpm}
          playing={compositionPlaying}
          position={compositionPosition}
          onPlay={(composition) => toggleLoop(composition)}
          onStop={stopLoop}
          onEdit={stopLoop}
          onChange={setDraftComposition}
          onPreview={(bol, emphasis, units) => {
            void strike(bol, emphasis, units);
          }}
          recording={recorder.recording}
          onRecord={() => {
            void recorder.toggleRecording();
          }}
        />
        <StudioNotes audioTiming={audioTiming} />
      </main>
      <footer>
        <span>Rooted in tradition. Played your way.</span>
        <span>
          Made for the love of rhythm <AudioLines size={15} />
        </span>
      </footer>
    </div>
  );
}
