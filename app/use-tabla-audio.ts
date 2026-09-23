'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  TablaAudio,
  tempoSeconds,
  type Taal,
  type Composition,
  practiceComposition,
  trackPosition,
  type TrackPlayback,
  audibleContextTime,
} from '@/lib/tabla';
import { useBolFlash } from './use-bol-flash';
import { useStudioKeys } from './use-studio-keys';

// Owns the audio engine, the practice/composition loop, and the stroke
// highlights. The recorder handles let the paths that stop or rebuild the
// engine stop an in-progress recording too.
export function useTablaAudio(recorder: {
  stopRecording: () => void;
  pending: () => boolean;
}) {
  const [bpm, setBpm] = useState(90);
  const [volume, setVolume] = useState(75);
  const [taal, setTaal] = useState<Taal>('teentaal');
  const [metronome, setMetronome] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [compositionPlaying, setCompositionPlaying] = useState(false);
  const [compositionPosition, setCompositionPosition] = useState(-1);
  const playMode = useRef<'taal' | 'composition' | null>(null);
  const playbackGeneration = useRef(0);
  const [busy, setBusy] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [ready, setReady] = useState(false);
  const [audioTiming, setAudioTiming] = useState('Not measured yet');
  const [error, setError] = useState('');
  const engine = useRef<TablaAudio | null>(null);
  const playback = useRef<TrackPlayback[]>([]);
  const [draftComposition, setDraftComposition] = useState<Composition | null>(
    null,
  );
  const playbackFrame = useRef<number | null>(null);
  const config = useRef({ bpm, taal, metronome, volume });
  useLayoutEffect(() => {
    config.current = { bpm, taal, metronome, volume };
  }, [bpm, taal, metronome, volume]);
  const pending = useRef(false);
  const mounted = useRef(true);
  const { active, clearFlashes, flash, flashWhenAudible } = useBolFlash(engine);
  const fail = (err: unknown) =>
    setError(
      err instanceof Error
        ? err.message
        : 'Audio could not start. Tap a stroke and try again.',
    );

  const stopLoop = useCallback(() => {
    playbackGeneration.current += 1;
    playMode.current = null;
    setCompositionPlaying(false);
    setCompositionPosition(-1);
    playback.current = [];
    if (playbackFrame.current !== null)
      cancelAnimationFrame(playbackFrame.current);
    playbackFrame.current = null;
    clearFlashes();
    setBusy(false);
    engine.current?.stopLoop();
    setPlaying(false);
    setBeat(-1);
  }, [clearFlashes]);
  const unlockAudio = useCallback(async () => {
    const audio = engine.current;
    if (!audio) throw new Error('Audio is not ready yet. Tap again to retry.');
    try {
      const unlocking = audio.unlock();
      if (unlocking) await unlocking;
      if (!mounted.current || engine.current !== audio)
        throw new Error('Audio restarted. Tap again to play.');
      audio.volume(config.current.volume);
      return audio;
    } catch (error) {
      if (mounted.current && engine.current === audio) {
        audio.dispose();
        engine.current = new TablaAudio();
        setReady(false);
      }
      throw error;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const audio = new TablaAudio();
    engine.current = audio;
    void audio
      .load()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        if (!cancelled) fail(err);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      if (playbackFrame.current !== null)
        cancelAnimationFrame(playbackFrame.current);
      engine.current?.dispose();
    };
  }, []);
  async function resetAudio() {
    if (pending.current || recorder.pending()) return;
    stopLoop();
    recorder.stopRecording();
    engine.current?.dispose();
    const audio = new TablaAudio();
    engine.current = audio;
    pending.current = true;
    setBusy(true);
    setReady(false);
    setError('');
    try {
      // Resume the fresh context within the button gesture, before waiting for samples.
      const unlocking = audio.unlock();
      audio.volume(volume);
      if (unlocking) await unlocking;
      if (!mounted.current || engine.current !== audio) return;
      setReady(true);
      const when = audio.context!.currentTime + 0.005;
      audio.play('Dha', when);
      flashWhenAudible(audio, 'Dha', when, 2 / 3);
      setAudioTiming('Audio connection reset; test Dha played');
    } catch (err) {
      if (mounted.current && engine.current === audio) fail(err);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const retrySounds = () => {
    void engine.current
      ?.load()
      .then(() => {
        setReady(true);
        setError('');
      })
      .catch(fail);
  };
  useEffect(() => {
    engine.current?.volume(volume);
  }, [volume]);

  const strike = useCallback(
    async (bol: string, emphasis = 1, units = 4) => {
      if (!engine.current) return;
      try {
        const audio = await unlockAudio();
        if (!mounted.current) return;
        setReady(true);
        setError('');
        const when = audio.context!.currentTime + 0.005;
        const duration = (tempoSeconds(config.current.bpm) * units) / 4;
        audio.play(bol, when, false, emphasis, duration);
        flashWhenAudible(audio, bol, when, duration);
      } catch (err) {
        fail(err);
      }
    },
    [flashWhenAudible, unlockAudio],
  );
  // Prepare both play modes while editing. Live tempo changes swap compiled
  // tracks at one shared sample time, preserving the musical position.
  useEffect(() => {
    const audio = engine.current;
    if (!ready || !audio) return;
    let cancelled = false;
    const generation = playbackGeneration.current;
    const timer = setTimeout(() => {
      const practice = practiceComposition(taal);
      const activeComposition =
        playMode.current === 'composition' ? draftComposition : practice;
      const prepare = async () => {
        try {
          const track = await audio.compile(
            activeComposition ?? practice,
            bpm,
            metronome,
          );
          if (
            cancelled ||
            engine.current !== audio ||
            generation !== playbackGeneration.current
          )
            return;
          const previous = playback.current.at(-1);
          if (previous && previous.track !== track) {
            const when = audio.context!.currentTime + 0.01;
            const offsetUnits = trackPosition(previous, when) % track.units;
            const source = audio.startCompiled(track, when, offsetUnits);
            previous.source.stop(when);
            playback.current.push({ track, source, when, offsetUnits });
          }
          if (draftComposition && activeComposition !== draftComposition)
            await audio.compile(draftComposition, bpm, metronome);
        } catch (err) {
          if (!cancelled && playback.current.length) fail(err);
        }
      };
      void prepare();
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, draftComposition, bpm, metronome, taal]);

  async function toggleLoop(composition?: Composition) {
    const mode = composition ? 'composition' : 'taal';
    if (playMode.current) {
      const sameMode = playMode.current === mode;
      stopLoop();
      if (sameMode) return;
    }
    if (pending.current || !engine.current) return;
    const requestedAt = performance.now();
    const generation = ++playbackGeneration.current;
    pending.current = true;
    playMode.current = mode;
    setBusy(true);
    setAudioTiming('Preparing the audio track…');
    try {
      const audio = await unlockAudio();
      let cfg = config.current;
      let track = await audio.compile(
        composition ?? practiceComposition(cfg.taal),
        cfg.bpm,
        cfg.metronome,
      );
      while (
        generation === playbackGeneration.current &&
        (cfg.bpm !== config.current.bpm ||
          cfg.metronome !== config.current.metronome ||
          cfg.taal !== config.current.taal)
      ) {
        cfg = config.current;
        track = await audio.compile(
          composition ?? practiceComposition(cfg.taal),
          cfg.bpm,
          cfg.metronome,
        );
      }
      if (!mounted.current || generation !== playbackGeneration.current) return;
      setReady(true);
      setError('');
      const when = audio.context!.currentTime + 0.005;
      const source = audio.startCompiled(track, when);
      playback.current = [{ track, source, when, offsetUnits: 0 }];
      const preparedMs = Math.round(performance.now() - requestedAt);
      setAudioTiming(
        `Track ready in ${preparedMs} ms; waiting for its first audio frame…`,
      );
      let began = false;
      let lastPosition = -1;
      let lastOutputTime = -Infinity;
      let lastProgressAt = performance.now();
      let lastDiagnosticAt = 0;
      let lastHit = '';
      const draw = () => {
        if (
          !mounted.current ||
          engine.current !== audio ||
          generation !== playbackGeneration.current
        )
          return;
        const outputTime = audibleContextTime(audio.context!);
        if (!began && performance.now() - lastDiagnosticAt > 500) {
          lastDiagnosticAt = performance.now();
          setAudioTiming(
            `Track ready in ${preparedMs} ms; audio ${audio.context!.state}, render ${audio.context!.currentTime.toFixed(3)} s, output ${outputTime.toFixed(3)} s, start ${when.toFixed(3)} s`,
          );
        }
        if (outputTime > lastOutputTime) {
          lastProgressAt = performance.now();
          lastOutputTime = outputTime;
        }
        // Keep the old timing until the replacement track reaches the speaker.
        while (
          playback.current.length > 1 &&
          playback.current[1].when <= outputTime
        )
          playback.current.shift();
        const current = playback.current[0];
        if (current && outputTime >= current.when) {
          const absolutePosition = trackPosition(current, outputTime);
          const position = Math.floor(absolutePosition) % current.track.units;
          if (!began) {
            began = true;
            setBusy(false);
            setPlaying(mode === 'taal');
            setCompositionPlaying(mode === 'composition');
            setAudioTiming(
              `Compiled track: ${preparedMs} ms preparation, ${Math.round(performance.now() - requestedAt)} ms to audio output; device latency ${Math.round(((audio.context!.baseLatency || 0) + (audio.context!.outputLatency || 0)) * 1000)} ms`,
            );
          }
          if (position !== lastPosition) {
            lastPosition = position;
            if (composition) setCompositionPosition(position);
            else setBeat(Math.floor(position / 4));
          }
          const cycle = Math.floor(absolutePosition / current.track.units);
          const withinCycle =
            (absolutePosition % current.track.units) *
            current.track.secondsPerUnit;
          const hitIndex = current.track.hits.findLastIndex(
            (hit) => hit.time <= withinCycle,
          );
          const hit = current.track.hits[hitIndex];
          const hitId = `${current.when}:${cycle}:${hitIndex}`;
          if (hit && hitId !== lastHit && withinCycle - hit.time < 0.05) {
            lastHit = hitId;
            flash(hit.bol, Math.min(150, current.track.secondsPerUnit * 800));
          }
        }
        if (performance.now() - lastProgressAt > 3000) {
          fail(new Error('The audio device paused. Tap Play to reconnect.'));
          stopLoop();
          recorder.stopRecording();
          return;
        }
        playbackFrame.current = requestAnimationFrame(draw);
      };
      playbackFrame.current = requestAnimationFrame(draw);
    } catch (err) {
      if (generation === playbackGeneration.current) {
        fail(err);
        stopLoop();
      }
    } finally {
      pending.current = false;
      if (generation === playbackGeneration.current && !playback.current.length)
        setBusy(false);
    }
  }
  const toggleLoopRef = useRef(toggleLoop);
  useLayoutEffect(() => {
    toggleLoopRef.current = toggleLoop;
  });
  useStudioKeys({ playMode, toggleLoopRef, stopLoop, strike });
  // Used by the model context tool: the ref keeps a following toggleLoop on the
  // new taal and tempo, before React has re-rendered.
  const applyPracticeConfig = useCallback(
    (nextTaal: Taal, nextBpm: number) => {
      stopLoop();
      config.current = { ...config.current, taal: nextTaal, bpm: nextBpm };
      setTaal(nextTaal);
      setBpm(nextBpm);
    },
    [stopLoop],
  );
  return {
    active,
    applyPracticeConfig,
    audioTiming,
    beat,
    bpm,
    busy,
    compositionPlaying,
    compositionPosition,
    error,
    fail,
    hasEngine: () => engine.current !== null,
    metronome,
    playing,
    ready,
    resetAudio,
    retrySounds,
    setBpm,
    setDraftComposition,
    setError,
    setMetronome,
    setTaal,
    setVolume,
    stopLoop,
    strike,
    taal,
    toggleLoop,
    unlockAudio,
    volume,
  };
}
