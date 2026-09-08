'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PARTS,
  STROKES,
  TAALS,
  TablaAudio,
  nextBeat,
  tempoSeconds,
  type Taal,
} from '@/lib/tabla';
import {
  AudioLines,
  Keyboard,
  Headphones,
  Play,
  Square,
  Minus,
  Plus,
  Circle,
  Volume2,
  VolumeX,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export default function Home() {
  const [bpm, setBpm] = useState(90);
  const [volume, setVolume] = useState(75);
  const [taal, setTaal] = useState<Taal>('teentaal');
  const [metronome, setMetronome] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [active, setActive] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordUrl, setRecordUrl] = useState('');
  const [recordExt, setRecordExt] = useState('webm');
  const [canRecord, setCanRecord] = useState(true);
  const engine = useRef<TablaAudio | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const scheduler = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const flashes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const config = useRef({ bpm, taal, metronome });
  config.current = { bpm, taal, metronome };
  const pending = useRef(false);
  const recordPending = useRef(false);
  const recordObjectUrl = useRef('');
  const mounted = useRef(true);
  const pattern = TAALS[taal];
  const fail = (err: unknown) =>
    setError(
      err instanceof Error
        ? err.message
        : 'Audio could not start. Tap a stroke and try again.',
    );

  const flash = useCallback((bol: string) => {
    const canonical =
      bol === 'Ta'
        ? 'Na'
        : bol === 'Ti'
          ? 'Te'
          : bol === 'Ka'
            ? 'Ke'
            : bol === 'Dhi'
              ? 'Dhin'
              : bol;
    const previous = flashes.current.get(canonical);
    if (previous) clearTimeout(previous);
    setActive((old) => [...new Set([...old, canonical])]);
    flashes.current.set(
      canonical,
      setTimeout(() => {
        flashes.current.delete(canonical);
        setActive((old) => old.filter((b) => b !== canonical));
      }, 150),
    );
  }, []);
  const stopLoop = useCallback(() => {
    if (scheduler.current) clearInterval(scheduler.current);
    scheduler.current = null;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    engine.current?.stopLoop();
    setPlaying(false);
    setBeat(-1);
  }, []);
  const stopRecording = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    setRecording(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const audio = new TablaAudio();
    engine.current = audio;
    void audio
      .load()
      .then(() => {
        if (mounted.current) setReady(true);
      })
      .catch((err) => {
        if (mounted.current) fail(err);
      });
    setCanRecord(typeof MediaRecorder !== 'undefined');
    const hide = () => {
      if (document.hidden) {
        stopLoop();
        stopRecording();
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', hide);
      if (scheduler.current) clearInterval(scheduler.current);
      timers.current.forEach(clearTimeout);
      flashes.current.forEach(clearTimeout);
      if (recorder.current?.state === 'recording') {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      if (recordObjectUrl.current) URL.revokeObjectURL(recordObjectUrl.current);
      audio.dispose();
    };
  }, [stopLoop, stopRecording]);
  useEffect(() => {
    engine.current?.volume(volume);
  }, [volume]);
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    setSeconds(0);
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSeconds(elapsed);
      if (elapsed >= 300) stopRecording();
    }, 250);
    return () => clearInterval(timer);
  }, [recording, stopRecording]);

  const strike = useCallback(
    async (bol: string) => {
      if (!engine.current) return;
      try {
        await engine.current.unlock();
        if (!mounted.current) return;
        setReady(true);
        setError('');
        engine.current.play(bol);
        flash(bol);
      } catch (err) {
        fail(err);
      }
    },
    [flash],
  );
  async function toggleLoop() {
    if (scheduler.current) {
      stopLoop();
      return;
    }
    if (pending.current || !engine.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await engine.current.unlock();
      if (!mounted.current) return;
      setReady(true);
      setError('');
      let index = 0;
      let when = engine.current.context!.currentTime + 0.04;
      const tick = () => {
        const audio = engine.current!;
        const now = audio.context!.currentTime;
        if (when < now - 0.15) when = now + 0.02;
        while (when < now + 0.1) {
          const cfg = config.current;
          const sequence = TAALS[cfg.taal];
          index %= sequence.beats.length;
          const current = index;
          const bol = sequence.beats[index];
          audio.play(bol, when, true, index === 0 ? 0.85 : 0.68);
          if (cfg.metronome) audio.click(when, index === 0);
          const timer = setTimeout(
            () => {
              timers.current.delete(timer);
              setBeat(current);
              flash(bol);
            },
            Math.max(0, (when - now) * 1000),
          );
          timers.current.add(timer);
          when += tempoSeconds(cfg.bpm);
          index = nextBeat(index, sequence.beats.length);
        }
      };
      tick();
      scheduler.current = setInterval(tick, 25);
      setPlaying(true);
    } catch (err) {
      fail(err);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const toggleLoopRef = useRef(toggleLoop);
  toggleLoopRef.current = toggleLoop;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        target.closest(
          'input,textarea,select,[role="slider"],[role="combobox"],[role="switch"],[role="listbox"],[role="option"],[contenteditable="true"]',
        )
      )
        return;
      if (event.code === 'Space') {
        if (target.closest('button,a,summary')) return;
        event.preventDefault();
        void toggleLoopRef.current();
        return;
      }
      const stroke = STROKES.find(
        (s) => s.key.toLowerCase() === event.key.toLowerCase(),
      );
      if (stroke) {
        event.preventDefault();
        void strike(stroke.bol);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [strike]);
  async function toggleRecording() {
    if (recorder.current?.state === 'recording') {
      stopRecording();
      return;
    }
    if (recordPending.current || !engine.current || !canRecord) return;
    recordPending.current = true;
    try {
      await engine.current.unlock();
      if (!mounted.current) return;
      const mime = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(
        engine.current.destination!.stream,
        mime ? { mimeType: mime } : undefined,
      );
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        if (!mounted.current) return;
        const type = rec.mimeType || chunks[0]?.type || 'audio/webm';
        const blob = new Blob(chunks, { type });
        if (recordObjectUrl.current)
          URL.revokeObjectURL(recordObjectUrl.current);
        recordObjectUrl.current = URL.createObjectURL(blob);
        setRecordUrl(recordObjectUrl.current);
        setRecordExt(
          type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm',
        );
        setRecording(false);
      };
      rec.onerror = () => {
        setError('Recording stopped unexpectedly. Please try a new recording.');
        setRecording(false);
      };
      recorder.current = rec;
      rec.start(250);
      setRecording(true);
      setSeconds(0);
      setError('');
    } catch (err) {
      fail(err);
    } finally {
      recordPending.current = false;
    }
  }
  function hitDrum(
    event: React.PointerEvent<HTMLButtonElement>,
    side: 'bayan' | 'dayan',
  ) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const distance = Math.hypot(
      (event.clientX - rect.left - rect.width / 2) / (rect.width / 2),
      (event.clientY - rect.top - rect.height / 2) / (rect.height / 2),
    );
    void strike(
      side === 'bayan'
        ? distance < 0.62
          ? 'Ge'
          : 'Ke'
        : distance < 0.43
          ? 'Tun'
          : distance < 0.76
            ? 'Tin'
            : 'Na',
    );
  }
  useEffect(() => {
    type Tool = {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'configure_tabla_practice',
            title: 'Configure tabla practice',
            description:
              'Set a taal and tempo in the visible practice controls. Stops any existing rhythm; press Start rhythm to play.',
            inputSchema: {
              type: 'object',
              properties: {
                taal: { type: 'string', enum: Object.keys(TAALS) },
                bpm: { type: 'integer', minimum: 40, maximum: 240 },
              },
              required: ['taal', 'bpm'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input: unknown) {
              const value = input as { taal: Taal; bpm: number };
              if (
                !value ||
                !Object.hasOwn(TAALS, value.taal) ||
                !Number.isInteger(value.bpm) ||
                value.bpm < 40 ||
                value.bpm > 240
              )
                throw new Error(
                  'Choose a supported taal and a whole-number tempo from 40 to 240 BPM.',
                );
              stopLoop();
              config.current = {
                ...config.current,
                taal: value.taal,
                bpm: value.bpm,
              };
              setTaal(value.taal);
              setBpm(value.bpm);
              return { taal: value.taal, bpm: value.bpm, playing: false };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [stopLoop]);
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
          </div>
        </div>
        {error && (
          <div className="audio-error" role="alert">
            {error}{' '}
            <button
              onClick={() =>
                void engine.current
                  ?.load()
                  .then(() => {
                    setReady(true);
                    setError('');
                  })
                  .catch(fail)
              }
            >
              Retry sounds
            </button>
          </div>
        )}
        <div className="workspace">
          <section className="instrument-panel" aria-label="Playable tabla">
            <div className="instrument-top">
              <span className="sound-status">
                <i /> {ready ? 'Ready when you are' : 'Loading tabla sounds…'}
              </span>
              <span className="keyboard-hint">
                <Keyboard size={16} /> Use your keyboard or tap
              </span>
            </div>
            <div className="drum-labels">
              <div>
                <strong>Bayan</strong>
                <span>The bass drum</span>
              </div>
              <div>
                <strong>Dayan</strong>
                <span>The melody drum</span>
              </div>
            </div>
            <div className="tabla-stage">
              <img
                src="/images/tabla-pair.jpg"
                alt="Silver bayan and wooden dayan tabla with ivory drum heads"
                width="1653"
                height="951"
                fetchPriority="high"
              />
              <button
                className={`drum-hit bayan ${active.some((b) => ['Ge', 'Ke', 'Dha', 'Dhin'].includes(b)) ? 'hit' : ''}`}
                aria-label="Play bayan: center Ge, rim Ke"
                onPointerDown={(e) => hitDrum(e, 'bayan')}
                onClick={(e) => {
                  if (e.detail === 0) void strike('Ge');
                }}
              >
                <span>
                  {active.find((b) =>
                    ['Ge', 'Ke', 'Dha', 'Dhin'].includes(b),
                  ) || 'Ge'}
                </span>
              </button>
              <button
                className={`drum-hit dayan ${active.some((b) => !['Ge', 'Ke'].includes(b)) ? 'hit' : ''}`}
                aria-label="Play dayan: center Tun, middle Tin, rim Na"
                onPointerDown={(e) => hitDrum(e, 'dayan')}
                onClick={(e) => {
                  if (e.detail === 0) void strike('Na');
                }}
              >
                <span>
                  {active.find((b) => !['Ge', 'Ke'].includes(b)) || 'Na'}
                </span>
              </button>
            </div>
            <div className="stage-caption">
              <span className="caption-line" />
              Tap a drum. Start a conversation.
              <span className="caption-line" />
            </div>
            <div className="stroke-deck">
              <div className="deck-heading">
                <h2>
                  The strokes <span> / bols</span>
                </h2>
                <span>Make them your own</span>
              </div>
              <div className="stroke-pads">
                {STROKES.map((s) => (
                  <button
                    className={`stroke-pad ${active.includes(s.bol) ? 'hit' : ''}`}
                    key={s.bol}
                    aria-label={`Play ${s.bol}, ${s.note}, key ${s.key}`}
                    aria-keyshortcuts={s.key.toLowerCase()}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      void strike(s.bol);
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) void strike(s.bol);
                    }}
                  >
                    <kbd>{s.key}</kbd>
                    <strong>{s.bol}</strong>
                    <span>{s.note}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
          <aside className="practice-sidebar">
            <section className="practice-panel">
              <div className="panel-title">
                <h2>Play along</h2>
                <AudioLines size={20} />
              </div>
              <p className="panel-description">
                A steady rhythm to find your flow.
              </p>
              <label className="field-label" id="taal-label">
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
                  className="taal-select"
                  aria-labelledby="taal-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teentaal">Teentaal · 16 beats</SelectItem>
                  <SelectItem value="keharwa">Keharwa · 8 beats</SelectItem>
                  <SelectItem value="dadra">Dadra · 6 beats</SelectItem>
                </SelectContent>
              </Select>
              <div className="tempo-heading">
                <label>Tempo</label>
                <div className="tempo-number">
                  <button
                    aria-label="Slower"
                    onClick={() => setBpm(Math.max(40, bpm - 5))}
                  >
                    <Minus size={14} />
                  </button>
                  <strong>{bpm}</strong>
                  <span>BPM</span>
                  <button
                    aria-label="Faster"
                    onClick={() => setBpm(Math.min(240, bpm + 5))}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <Slider
                aria-label="Tempo"
                value={[bpm]}
                min={40}
                max={240}
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
                onClick={() => void toggleLoop()}
                disabled={busy}
                aria-keyshortcuts="Space"
              >
                {playing ? (
                  <Square size={15} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" />
                )}
                {busy
                  ? 'Getting ready…'
                  : playing
                    ? 'Stop rhythm'
                    : 'Start rhythm'}
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
            <section className="record-panel">
              <div className="panel-title">
                <h2>Keep the moment</h2>
                <span
                  className={`record-time ${recording ? 'is-recording' : ''}`}
                >
                  {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                  {String(seconds % 60).padStart(2, '0')}
                </span>
              </div>
              <p>Capture a phrase. Or your whole flow.</p>
              <button
                className={`record-button ${recording ? 'recording' : ''}`}
                onClick={() => void toggleRecording()}
                disabled={!canRecord}
              >
                {recording ? (
                  <Square size={12} fill="currentColor" />
                ) : (
                  <Circle size={14} fill="currentColor" />
                )}
                {recording ? 'Stop recording' : 'Record session'}
              </button>
              <span className="record-footnote">
                {!canRecord
                  ? 'Recording isn’t supported in this browser.'
                  : recording
                    ? 'Recording your session · 5-minute maximum'
                    : 'Just your tabla. No microphone needed.'}
              </span>
              {recordUrl && (
                <div className="recording-result">
                  <audio
                    controls
                    src={recordUrl}
                    aria-label="Your recorded tabla session"
                  />
                  <a
                    className="download-link"
                    href={recordUrl}
                    download={`taal-session.${recordExt}`}
                  >
                    <Download size={14} />
                    Download recording
                  </a>
                  <p>Download to keep it. Recordings stay in this tab.</p>
                </div>
              )}
            </section>
          </aside>
        </div>
        <section className="guide-strip" id="guide">
          <div className="guide-symbol">
            <Keyboard size={22} />
          </div>
          <div>
            <h2>Your keyboard is your instrument.</h2>
            <p>
              Try <kbd>J</kbd> <kbd>F</kbd> <kbd>F</kbd> <kbd>D</kbd> — Dha,
              Tin, Tin, Na. Then follow your ears.
            </p>
          </div>
          <span className="guide-aside">
            No right way to begin.
            <br />
            Just a first beat.
          </span>
        </section>
        <details className="guide-details">
          <summary>Playing tips & sound notes</summary>
          <p>
            Use A, S, D, F, G, H, J, and K to play the labeled strokes. You can
            press multiple keys together. Tap the center or rim of each drum for
            different bols. Space starts or stops the practice rhythm when a
            control is not focused. Change the tempo as you play; choosing
            another taal stops the current cycle.
          </p>
          <p>
            The blue beat marks sam, the beginning of the cycle. An open circle
            marks khali. The metronome follows the practice rhythm. Recording
            captures your strokes, the rhythm, and the click at the current
            volume. Save a recording before reloading or closing this tab.
            Switching away from the tab stops the rhythm and recording.
          </p>
          <p>
            Na, Tun, Te, Ge, and Ke use real CC0 tabla recordings by mmiron,
            distributed with{' '}
            <a
              href="https://github.com/sonic-pi-net/sonic-pi/blob/dev/etc/samples/README.md"
              target="_blank"
              rel="noreferrer"
            >
              Sonic Pi
            </a>
            . Tin is a synthesized membrane tone; Dha and Dhin combine the
            corresponding bass and treble voices. Rhythm patterns use simplified
            articulations: Ta → Na, Ti → Te, Ka → Ke, Dhi → Dhin.{' '}
            <a href="/audio/ATTRIBUTION.md">Audio sources & license</a>.
          </p>
        </details>
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
