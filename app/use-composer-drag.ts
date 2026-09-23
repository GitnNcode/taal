'use client';

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type DragEvent,
} from 'react';
import type { CompositionStep } from '@/lib/tabla';

export type Source = { id: string } | { bol: CompositionStep['bol'] };

// Mouse drag and touch drag for the bol palette and the timeline. onDrop is
// called with the slot that was released over.
export function useComposerDrag(
  onDrop: (targetId: string, dragged: Source) => void,
) {
  const [over, setOver] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const source = useRef<Source | null>(null);
  const touch = useRef<{
    x: number;
    y: number;
    active: boolean;
    source: Source;
    label: string;
  } | null>(null);
  const suppressClick = useRef(false);
  function dragStart(event: DragEvent, dragged: Source, label: string) {
    source.current = dragged;
    event.dataTransfer.effectAllowed = 'id' in dragged ? 'move' : 'copy';
    event.dataTransfer.setData('text/plain', label);
  }
  function dragEnd() {
    source.current = null;
    setOver(null);
    setGhost(null);
  }
  function touchStart(
    event: ReactPointerEvent<HTMLButtonElement>,
    dragged: Source,
    label: string,
  ) {
    if (event.pointerType === 'mouse') return;
    touch.current = {
      x: event.clientX,
      y: event.clientY,
      active: false,
      source: dragged,
      label,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function touchMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = touch.current;
    if (!drag) return;
    if (
      !drag.active &&
      Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7
    )
      return;
    drag.active = true;
    event.preventDefault();
    setGhost({ x: event.clientX, y: event.clientY, label: drag.label });
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-composer-slot]');
    setOver(target?.dataset.composerSlot || null);
    if (event.clientY > window.innerHeight - 65) window.scrollBy(0, 12);
    if (event.clientY < 65) window.scrollBy(0, -12);
  }
  function touchEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = touch.current;
    touch.current = null;
    if (drag?.active) {
      suppressClick.current = true;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-composer-slot]');
      if (target?.dataset.composerSlot)
        onDrop(target.dataset.composerSlot, drag.source);
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    setGhost(null);
    setOver(null);
  }
  const dragEvents = (dragged: Source, label: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent<HTMLButtonElement>) =>
      dragStart(e, dragged, label),
    onDragEnd: dragEnd,
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) =>
      touchStart(e, dragged, label),
    onPointerMove: touchMove,
    onPointerUp: touchEnd,
    onPointerCancel: () => {
      touch.current = null;
      setGhost(null);
      setOver(null);
    },
  });
  return { dragEnd, dragEvents, ghost, over, setOver, source, suppressClick };
}

export type DragEventsFactory = ReturnType<
  typeof useComposerDrag
>['dragEvents'];
