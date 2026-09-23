'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  newComposition,
  parseCompositionDraft,
  type Composition,
} from '@/lib/tabla';

const STORAGE_KEY = 'taal-composition-v1';

// The composition itself: the browser-stored draft, the undo history, and the
// two ways of changing it. current mirrors the composition synchronously so
// that edits made in the same tick build on each other.
export function useCompositionDraft({
  bpm,
  script,
  setBpm,
  setScript,
  onEdit,
  onChange,
}: {
  bpm: number;
  script: string;
  setBpm: (value: number) => void;
  setScript: (text: string) => void;
  onEdit: () => void;
  onChange: (composition: Composition) => void;
}) {
  const [composition, setComposition] = useState<Composition | null>(null);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<
    { composition: Composition; bpm?: number; script?: string }[]
  >([]);
  const [cycleInput, setCycleInput] = useState('16');
  const current = useRef(composition);
  useEffect(() => {
    if (composition) onChange(composition);
  }, [composition, onChange]);
  useLayoutEffect(() => {
    current.current = composition;
  }, [composition]);
  useEffect(() => {
    let initial = newComposition();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const draft = parseCompositionDraft(JSON.parse(stored));
        initial = draft.composition;
        setBpm(draft.bpm);
        setScript(draft.script);
      }
    } catch {
      setNotice(
        'Your saved draft could not be opened. Start a new one or import a saved file.',
      );
    }
    setComposition(initial);
    setCycleInput(String(initial.beatsPerCycle));
  }, [setBpm, setScript]);
  useLayoutEffect(() => {
    if (!composition) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...composition, bpm, script }),
      );
      setSaved(true);
    } catch {
      setSaved(false);
      setNotice(
        'Browser storage is unavailable. Export your composition to keep it.',
      );
    }
  }, [composition, bpm, script]);
  function edit(
    next: Composition,
    message = '',
    restore?: { bpm: number; script: string },
  ) {
    const previous = current.current;
    if (!previous || next === previous) return;
    onEdit();
    setHistory((old) => [
      ...old.slice(-29),
      { composition: previous, ...restore },
    ]);
    current.current = next;
    setComposition(next);
    setCycleInput(String(next.beatsPerCycle));
    setNotice(message);
  }
  function restore(next: Composition) {
    current.current = next;
    setComposition(next);
  }
  function attempt(action: () => Composition, message = '') {
    try {
      edit(action(), message);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'That change could not be made.',
      );
    }
  }
  return {
    attempt,
    composition,
    current,
    cycleInput,
    edit,
    history,
    notice,
    restore,
    saved,
    setComposition,
    setCycleInput,
    setHistory,
    setNotice,
  };
}
