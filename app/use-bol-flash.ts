'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  STROKES,
  TablaAudio,
  audibleContextTime,
  bolHits,
  PARTS,
} from '@/lib/tabla';

// Lights the stroke pads and drum markers, but only once each sound has
// actually reached the speaker.
export function useBolFlash(engine: RefObject<TablaAudio | null>) {
  const [active, setActive] = useState<string[]>([]);
  const flashes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const previewFrames = useRef(new Set<number>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      previewFrames.current.forEach(cancelAnimationFrame);
      previewFrames.current.clear();
      flashes.current.forEach(clearTimeout);
    };
  }, []);
  const flash = useCallback((bol: string, durationMs = 150) => {
    const canonical =
      bol === 'Ta'
        ? 'Na'
        : bol === 'Ti'
          ? 'Te'
          : bol === 'Ka'
            ? 'Ke'
            : bol === 'Dhi'
              ? 'Dhin'
              : STROKES.some((stroke) => stroke.bol === bol)
                ? bol
                : (STROKES.find(
                    (stroke) => PARTS[stroke.bol]?.[0] === PARTS[bol]?.[0],
                  )?.bol ?? bol);
    const previous = flashes.current.get(canonical);
    if (previous) clearTimeout(previous);
    setActive((old) => [...new Set([...old, canonical])]);
    flashes.current.set(
      canonical,
      setTimeout(() => {
        flashes.current.delete(canonical);
        setActive((old) => old.filter((b) => b !== canonical));
      }, durationMs),
    );
  }, []);
  const flashWhenAudible = useCallback(
    (audio: TablaAudio, bol: string, when: number, duration: number) => {
      const hits = bolHits(bol, duration);
      const deadline = performance.now() + (duration + 8) * 1000;
      let frame = 0;
      const drawPreview = () => {
        previewFrames.current.delete(frame);
        if (
          !mounted.current ||
          engine.current !== audio ||
          performance.now() > deadline
        )
          return;
        const outputTime = audibleContextTime(audio.context!);
        while (hits.length && when + hits[0].offset <= outputTime) {
          const hit = hits.shift()!;
          if (outputTime - when - hit.offset < 0.05)
            flash(hit.bol, Math.min(150, duration * 200));
        }
        if (hits.length) {
          frame = requestAnimationFrame(drawPreview);
          previewFrames.current.add(frame);
        }
      };
      drawPreview();
    },
    [flash],
  );
  const clearFlashes = useCallback(() => {
    flashes.current.forEach(clearTimeout);
    flashes.current.clear();
    setActive([]);
  }, []);
  return { active, clearFlashes, flash, flashWhenAudible };
}
