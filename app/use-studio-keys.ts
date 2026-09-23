'use client';

import { useEffect, type RefObject } from 'react';
import { STROKES } from '@/lib/tabla';

// Keyboard bindings for the studio: the stroke keys, and Space for the
// practice loop when no control has focus.
export function useStudioKeys({
  playMode,
  toggleLoopRef,
  stopLoop,
  strike,
}: {
  playMode: RefObject<'taal' | 'composition' | null>;
  toggleLoopRef: RefObject<() => Promise<void>>;
  stopLoop: () => void;
  strike: (bol: string) => Promise<void>;
}) {
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
        if (playMode.current === 'composition') stopLoop();
        else void toggleLoopRef.current();
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
  }, [playMode, stopLoop, strike, toggleLoopRef]);
}
