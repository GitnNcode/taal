'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { ArrowRight, Pause, Plus } from 'lucide-react';
import type {
  Composition,
  CompositionStep,
  compositionTimeline,
} from '@/lib/tabla';
import type { DragEventsFactory, Source } from './use-composer-drag';

export const durationLabel = (units: number) =>
  `${units / 4} ${units === 4 ? 'beat' : 'beats'}`;

export default function ComposerTimeline({
  composition,
  timeline,
  total,
  cycles,
  cycleUnits,
  playing,
  position,
  selected,
  setSelected,
  activeId,
  brush,
  over,
  setOver,
  source,
  suppressClick,
  dragEvents,
  onDrop,
  dragEnd,
  onAddCycle,
  onRemoveCycle,
}: {
  composition: Composition;
  timeline: ReturnType<typeof compositionTimeline>;
  total: number;
  cycles: number;
  cycleUnits: number;
  playing: boolean;
  position: number;
  selected: string | null;
  setSelected: (id: string | null) => void;
  activeId: string | null | undefined;
  brush: CompositionStep['bol'];
  over: string | null;
  setOver: Dispatch<SetStateAction<string | null>>;
  source: RefObject<Source | null>;
  suppressClick: RefObject<boolean>;
  dragEvents: DragEventsFactory;
  onDrop: (targetId: string, dragged: Source) => void;
  dragEnd: () => void;
  onAddCycle: () => void;
  onRemoveCycle: () => void;
}) {
  return (
    <>
      <div className="cycle-scroll">
        <div
          className="cycle-list"
          style={{
            minWidth: Math.max(480, composition.beatsPerCycle * 52),
          }}
        >
          {Array.from({ length: cycles }, (_, cycle) => {
            const cycleStart = cycle * cycleUnits;
            const segments = timeline.filter(
              (step) =>
                step.start < cycleStart + cycleUnits &&
                step.start + step.units > cycleStart,
            );
            return (
              <div className="composition-cycle" key={cycle}>
                <div className="cycle-heading">
                  <strong>Cycle {cycle + 1}</strong>
                  <span>
                    {cycle === 0
                      ? 'Sam on beat 1'
                      : `Beats ${cycle * composition.beatsPerCycle + 1}–${(cycle + 1) * composition.beatsPerCycle}`}
                  </span>
                </div>
                <div
                  className="cycle-ruler"
                  style={{
                    gridTemplateColumns: `repeat(${composition.beatsPerCycle},minmax(0,1fr))`,
                  }}
                >
                  {Array.from({ length: composition.beatsPerCycle }, (_, i) => (
                    <span
                      key={i}
                      className={
                        playing &&
                        Math.floor(position / 4) ===
                          cycle * composition.beatsPerCycle + i
                          ? 'ruler-current'
                          : ''
                      }
                    >
                      {i + 1}
                    </span>
                  ))}
                </div>
                <div
                  className="cycle-track"
                  style={{
                    gridTemplateColumns: `repeat(${cycleUnits},minmax(0,1fr))`,
                  }}
                >
                  {segments.map((step) => {
                    const start = Math.max(step.start, cycleStart) - cycleStart;
                    const length =
                      Math.min(
                        step.start + step.units,
                        cycleStart + cycleUnits,
                      ) - Math.max(step.start, cycleStart);
                    const continued = step.start < cycleStart;
                    return (
                      <button
                        key={`${cycle}-${step.id}`}
                        data-composer-slot={step.id}
                        style={{
                          gridColumn: `${start + 1} / span ${length}`,
                        }}
                        className={`composition-step ${step.bol === null ? 'empty-step' : ''} ${step.bol === 'Rest' ? 'rest-step' : ''} ${selected === step.id ? 'selected-step' : ''} ${over === step.id ? 'drop-target' : ''} ${activeId === step.id ? 'playing-step' : ''} ${step.emphasis >= 1 ? 'accent-step' : ''} ${length < 4 ? 'short-step' : ''}`}
                        title={`${step.bol || 'Empty'}, ${durationLabel(step.units)}, emphasis ${Math.round(step.emphasis * 100)}%${continued ? ', continues from previous cycle' : ''}`}
                        aria-label={`${step.bol || 'Empty beat'}, cycle ${cycle + 1}, beat ${start / 4 + 1}, ${durationLabel(step.units)}${step.bol ? ', select to edit' : `, click to place ${brush}`}`}
                        aria-pressed={selected === step.id}
                        {...(step.bol
                          ? dragEvents({ id: step.id }, step.bol)
                          : {})}
                        onDragOver={(e) => {
                          if (source.current) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect =
                              'id' in source.current ? 'move' : 'copy';
                            setOver(step.id);
                          }
                        }}
                        onDragLeave={() =>
                          setOver((old) => (old === step.id ? null : old))
                        }
                        onDrop={(e) => {
                          e.preventDefault();
                          if (source.current) onDrop(step.id, source.current);
                          dragEnd();
                        }}
                        onClick={() => {
                          if (suppressClick.current) return;
                          if (step.bol === null) {
                            onDrop(step.id, { bol: brush });
                          } else setSelected(step.id);
                        }}
                      >
                        {step.bol ? (
                          <>
                            <span className="step-label">
                              {continued && <ArrowRight size={12} />}{' '}
                              {step.bol === 'Rest' ? <Pause size={15} /> : null}
                              {step.bol}
                            </span>
                            <small>{durationLabel(step.units)}</small>
                            <span
                              className="emphasis-meter"
                              aria-hidden="true"
                              style={{
                                width: `${(step.emphasis / 1.25) * 75}%`,
                              }}
                            />
                          </>
                        ) : (
                          <Plus size={15} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="cycle-controls">
        <button className="secondary-button" onClick={onAddCycle}>
          <Plus size={15} />
          Add cycle <span>+{composition.beatsPerCycle} beats</span>
        </button>
        <button
          className="text-button"
          disabled={
            cycles <= 1 ||
            timeline.some(
              (step) =>
                step.bol !== null &&
                step.start + step.units > total - cycleUnits,
            )
          }
          onClick={onRemoveCycle}
        >
          Remove last empty cycle
        </button>
      </div>
    </>
  );
}
