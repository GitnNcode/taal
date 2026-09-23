'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TablaAudio } from '@/lib/tabla';

// Records the studio output stream. It needs the audio hook to unlock the
// context first, and reports its failures through the same error banner.
export function useRecorder(audio: {
  unlockAudio: () => Promise<TablaAudio>;
  hasEngine: () => boolean;
  fail: (err: unknown) => void;
  setError: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordUrl, setRecordUrl] = useState('');
  const [recordExt, setRecordExt] = useState('webm');
  const [canRecord, setCanRecord] = useState(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordPending = useRef(false);
  const recordingGeneration = useRef(0);
  const recordObjectUrl = useRef('');
  const mounted = useRef(true);
  const stopRecording = useCallback(() => {
    recordingGeneration.current += 1;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    setRecording(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    setCanRecord(typeof MediaRecorder !== 'undefined');
    return () => {
      mounted.current = false;
      if (recorder.current?.state === 'recording') {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      if (recordObjectUrl.current) URL.revokeObjectURL(recordObjectUrl.current);
    };
  }, []);
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
  async function toggleRecording() {
    if (recorder.current?.state === 'recording') {
      stopRecording();
      return;
    }
    if (recordPending.current || !audio.hasEngine() || !canRecord) return;
    recordPending.current = true;
    const generation = ++recordingGeneration.current;
    try {
      const engine = await audio.unlockAudio();
      if (!mounted.current || generation !== recordingGeneration.current)
        return;
      const mime = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(
        engine.destination!.stream,
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
        audio.setError(
          'Recording stopped unexpectedly. Please try a new recording.',
        );
        setRecording(false);
      };
      recorder.current = rec;
      rec.start(250);
      setRecording(true);
      setSeconds(0);
      audio.setError('');
    } catch (err) {
      audio.fail(err);
    } finally {
      recordPending.current = false;
    }
  }
  return {
    canRecord,
    pending: () => recordPending.current,
    recordExt,
    recordUrl,
    recording,
    seconds,
    stopRecording,
    toggleRecording,
  };
}
