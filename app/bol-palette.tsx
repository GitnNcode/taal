'use client';

import { useState, type RefObject } from 'react';
import { GripVertical, Pause } from 'lucide-react';
import {
  COMPOSITION_BOLS,
  bolDescription,
  type CompositionStep,
} from '@/lib/tabla';
import type { DragEventsFactory } from './use-composer-drag';

export default function BolPalette({
  brush,
  setBrush,
  onPreview,
  dragEvents,
  suppressClick,
  cycles,
  total,
}: {
  brush: CompositionStep['bol'];
  setBrush: (bol: CompositionStep['bol']) => void;
  onPreview: (bol: string, emphasis?: number, units?: number) => void;
  dragEvents: DragEventsFactory;
  suppressClick: RefObject<boolean>;
  cycles: number;
  total: number;
}) {
  const [bolSearch, setBolSearch] = useState('');
  return (
    <>
      <div className="bol-library-search">
        <label htmlFor="bol-search">
          Bol & phrase library <span>{COMPOSITION_BOLS.length} sounds</span>
        </label>
        <input
          id="bol-search"
          type="search"
          placeholder="Find a bol… e.g. Terekete, Kran, Dhage"
          value={bolSearch}
          onChange={(e) => setBolSearch(e.target.value)}
        />
      </div>
      <div
        className="bol-palette"
        aria-label="Drag a bol or rest into your composition"
      >
        {[...COMPOSITION_BOLS, 'Rest' as const]
          .filter(
            (bol) =>
              bol === 'Rest' ||
              (bol + ' ' + bolDescription(bol))
                .toLowerCase()
                .includes(bolSearch.trim().toLowerCase()),
          )
          .map((bol) => (
            <button
              key={bol}
              title={bolDescription(bol)}
              className={`palette-bol ${brush === bol ? 'brush-active' : ''} ${bol === 'Rest' ? 'rest-palette' : ''}`}
              aria-pressed={brush === bol}
              aria-label={`Drag ${bol}, or select then click an empty beat`}
              {...dragEvents({ bol }, bol)}
              onClick={() => {
                if (suppressClick.current) return;
                setBrush(bol);
                if (bol !== 'Rest') onPreview(bol);
              }}
            >
              <GripVertical size={14} />
              {bol === 'Rest' && <Pause size={13} />}
              <span>{bol}</span>
            </button>
          ))}
      </div>
      <div className="composition-hint">
        <span>
          Drag to place or reorder. Or select a bol above and click an empty
          beat.
        </span>
        <span>
          {cycles} {cycles === 1 ? 'cycle' : 'cycles'} / {total / 4} beats
        </span>
      </div>
    </>
  );
}
