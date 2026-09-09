'use client';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type DragEvent,
} from 'react';
import {
  GripVertical,
  LoaderCircle,
  Plus,
  Minus,
  Play,
  Square,
  Circle,
  Pause,
  Download,
  Upload,
  FilePlus2,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Undo2,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  STROKES,
  MIN_BPM,
  MAX_BPM,
  COMPOSITION_BOLS,
  bolDescription,
  TAALS,
  newComposition,
  fitComposition,
  compositionUnits,
  compositionTimeline,
  compositionStep,
  placeCompositionStep,
  changeCompositionStep,
  resizeComposition,
  parseComposition,
  parseBolScript,
  formatBolScript,
  type Composition,
  type CompositionStep,
  type Taal,
} from '@/lib/tabla';

type Source = { id: string } | { bol: CompositionStep['bol'] };
const STORAGE_KEY = 'taal-composition-v1';
const durationLabel = (units: number) =>
  `${units / 4} ${units === 4 ? 'beat' : 'beats'}`;
export default function CompositionMaker({
  audioReady,
  bpm,
  setBpm,
  playing,
  position,
  onPlay,
  onStop,
  onEdit,
  onPreview,
  recording,
  onRecord,
}: {
  audioReady: boolean;
  bpm: number;
  setBpm: (value: number) => void;
  playing: boolean;
  position: number;
  onPlay: (composition: Composition) => Promise<void>;
  onStop: () => void;
  onEdit: () => void;
  onPreview: (bol: string, emphasis?: number, units?: number) => void;
  recording: boolean;
  onRecord: () => void;
}) {
  const [composition, setComposition] = useState<Composition | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [brush, setBrush] = useState<CompositionStep['bol']>('Dha');
  const [over, setOver] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const [bolSearch, setBolSearch] = useState('');
  const [script, setScript] = useState('');
  const [scriptError, setScriptError] = useState('');
  const [saved, setSaved] = useState(false);
  const [starting, setStarting] = useState(false);
  const [history, setHistory] = useState<Composition[]>([]);
  const [cycleInput, setCycleInput] = useState('16');
  const source = useRef<Source | null>(null);
  const touch = useRef<{
    x: number;
    y: number;
    active: boolean;
    source: Source;
    label: string;
  } | null>(null);
  const suppressClick = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const current = useRef(composition);
  current.current = composition;
  useEffect(() => {
    let initial = newComposition();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) initial = parseComposition(JSON.parse(stored));
    } catch {
      setNotice(
        'Your saved draft could not be opened. Start a new one or import a saved file.',
      );
    }
    setComposition(initial);
    setCycleInput(String(initial.beatsPerCycle));
  }, []);
  useEffect(() => {
    if (!composition) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(composition));
      setSaved(true);
    } catch {
      setSaved(false);
      setNotice(
        'Browser storage is unavailable. Export your composition to keep it.',
      );
    }
  }, [composition]);
  if (!composition)
    return (
      <section id="compose" className="composer">
        <h2>Composition maker</h2>
        <p>Opening your draft…</p>
      </section>
    );
  const timeline = compositionTimeline(composition);
  const total = compositionUnits(composition.steps);
  const cycleUnits = composition.beatsPerCycle * 4;
  const cycles = total / cycleUnits;
  const chosen = composition.steps.find((step) => step.id === selected);
  const chosenIndex = composition.steps.findIndex(
    (step) => step.id === selected,
  );
  const activeId = playing
    ? timeline.find(
        (step) => position >= step.start && position < step.start + step.units,
      )?.id
    : null;
  const hasNotes = composition.steps.some((step) => step.bol !== null);
  function edit(next: Composition, message = '') {
    const previous = current.current;
    if (!previous || next === previous) return;
    onEdit();
    setHistory((old) => [...old.slice(-29), previous]);
    current.current = next;
    setComposition(next);
    setCycleInput(String(next.beatsPerCycle));
    setNotice(message);
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
  function drop(targetId: string, dragged: Source) {
    const previous = current.current!;
    attempt(
      () => placeCompositionStep(previous, targetId, dragged),
      'Placed. Select a bol to change its duration or emphasis.',
    );
    const next = current.current!;
    const newId =
      'id' in dragged
        ? dragged.id
        : next.steps.find(
            (step) =>
              !previous.steps.some((old) => old.id === step.id) &&
              step.bol === dragged.bol,
          )?.id;
    if (newId) setSelected(newId);
    setOver(null);
  }
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
        drop(target.dataset.composerSlot, drag.source);
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    setGhost(null);
    setOver(null);
  }
  function moveSelected(direction: -1 | 1) {
    if (chosenIndex < 0 || !chosen) return;
    const other = chosenIndex + direction;
    if (other < 0 || other >= composition!.steps.length) return;
    const steps = [...composition!.steps];
    [steps[chosenIndex], steps[other]] = [steps[other], steps[chosenIndex]];
    attempt(() => ({
      ...composition!,
      steps: fitComposition(steps, composition!.beatsPerCycle, total),
    }));
  }
  function loadTaal(taal: Taal) {
    const aliases: Record<string, CompositionStep['bol']> = {
      Ta: 'Na',
      Ti: 'Te',
      Ka: 'Ke',
      Dhi: 'Dhin',
    };
    const pattern = TAALS[taal];
    const steps = pattern.beats.map((bol, i) => ({
      ...compositionStep(aliases[bol] || (bol as CompositionStep['bol'])),
      emphasis: i === 0 ? 1 : 0.8,
    }));
    edit(
      {
        version: 1,
        name: `My ${pattern.name}`,
        beatsPerCycle: pattern.beats.length,
        steps,
      },
      'Pattern loaded. Drag to rearrange it, or select a bol to shape it.',
    );
    setSelected(steps[0].id);
  }
  function applyScript(replace: boolean) {
    try {
      const added = parseBolScript(script);
      const previous = current.current!;
      const existing = [...previous.steps];
      while (existing.length && existing.at(-1)!.bol === null) existing.pop();
      const steps = fitComposition(
        replace ? added : [...existing, ...added],
        previous.beatsPerCycle,
      );
      edit(
        { ...previous, steps },
        `${added.length} bols ${replace ? 'loaded' : 'added'}. Select any bol to adjust its length and emphasis.`,
      );
      setSelected(added[0].id);
      setScriptError('');
    } catch (err) {
      setScriptError(
        err instanceof Error ? err.message : 'Could not read these bols.',
      );
    }
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
  return (
    <section
      id="compose"
      className="composer"
      aria-labelledby="composer-heading"
    >
      <div className="composer-heading">
        <div>
          <h2 id="composer-heading">Make it your own.</h2>
          <p>
            Drag a bol into the timeline. Give it time, space, and emphasis.
          </p>
        </div>
        <span className="draft-status">
          {saved ? 'Draft saved in this browser' : 'Local draft'}
        </span>
      </div>
      <div className="composition-toolbar">
        <label className="composition-name">
          Composition name
          <input
            maxLength={100}
            value={composition.name}
            onChange={(e) => {
              setComposition({ ...composition, name: e.target.value });
            }}
          />
        </label>
        <label className="cycle-input">
          Beats per cycle
          <input
            aria-label="Beats per cycle"
            type="number"
            min={1}
            max={64}
            value={cycleInput}
            onChange={(e) => setCycleInput(e.target.value)}
            onBlur={() => {
              const beats = Number(cycleInput);
              if (beats !== composition.beatsPerCycle)
                attempt(
                  () => resizeComposition(composition, beats),
                  'Cycle length updated; your bols have been kept.',
                );
              setCycleInput(String(current.current!.beatsPerCycle));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </label>
        <div className="composer-tempo">
          <span>Tempo</span>
          <div>
            <button
              aria-label="Decrease composition tempo"
              onClick={() => setBpm(Math.max(MIN_BPM, bpm - 5))}
            >
              <Minus size={15} />
            </button>
            <strong>{bpm}</strong>
            <span>BPM</span>
            <button
              aria-label="Increase composition tempo"
              onClick={() => setBpm(Math.min(MAX_BPM, bpm + 5))}
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
        <div className="composer-actions">
          <button
            className="secondary-button"
            onClick={() => {
              const previous = history.at(-1);
              if (previous) {
                onEdit();
                setComposition(previous);
                current.current = previous;
                setCycleInput(String(previous.beatsPerCycle));
                setHistory((old) => old.slice(0, -1));
                setSelected(null);
                setNotice('Last change undone.');
              }
            }}
            disabled={!history.length}
          >
            <Undo2 size={15} />
            Undo
          </button>
          <button
            className="primary-button composition-play"
            disabled={!audioReady || starting || (!hasNotes && !playing)}
            onClick={async () => {
              if (playing) {
                onStop();
                return;
              }
              setStarting(true);
              try {
                await onPlay(composition);
              } finally {
                setStarting(false);
              }
            }}
          >
            {starting ? (
              <LoaderCircle size={15} className="audio-loading-spinner" />
            ) : playing ? (
              <Square size={15} fill="currentColor" />
            ) : (
              <Play size={15} fill="currentColor" />
            )}
            {starting
              ? 'Starting audio…'
              : playing
                ? 'Stop composition'
                : 'Play composition'}
          </button>
          <button
            className={`secondary-button ${recording ? 'recording' : ''}`}
            onClick={onRecord}
          >
            <Circle size={13} fill="currentColor" />
            {recording ? 'Stop recording' : 'Record'}
          </button>
        </div>
      </div>
      <details className="bol-script">
        <summary>Write a composition with bols</summary>
        <label htmlFor="bol-script-input">Comma-separated bols</label>
        <p id="bol-script-help">
          Each bol defaults to one beat. Add a length in parentheses, such as
          Terekete(2), and emphasis in brackets, such as Terekete(2)[90]. The
          bracket number is already a percent, so do not add a % sign. Use Rest,
          Pause, or - for silence. Extra space is filled to complete your chosen
          cycle.
        </p>
        <textarea
          id="bol-script-input"
          rows={3}
          placeholder="Dha(2)[110], Dhin[70], Terekete(0.5)[90], Rest(2), Na"
          value={script}
          onChange={(event) => {
            setScript(event.target.value);
            setScriptError('');
          }}
          aria-describedby="bol-script-help bol-script-error"
          aria-invalid={!!scriptError}
          spellCheck={false}
        />
        <p id="bol-script-error" role="alert">
          {scriptError}
        </p>
        <div className="bol-script-actions">
          <button
            className="secondary-button"
            disabled={!hasNotes}
            onClick={() => {
              setScript(formatBolScript(composition.steps));
              setScriptError('');
              setNotice('Current timeline copied to the text box.');
            }}
          >
            Current timeline → text
          </button>
          <button
            className="primary-button"
            disabled={!script.trim()}
            onClick={() => applyScript(false)}
          >
            Add to composition
          </button>
          <button
            className="secondary-button"
            disabled={!script.trim()}
            onClick={() => applyScript(true)}
          >
            Replace composition
          </button>
          <span>Copying to text does not change your timeline.</span>
        </div>
      </details>
      <div className="composer-body">
        <div className="composition-workspace">
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
                      {Array.from(
                        { length: composition.beatsPerCycle },
                        (_, i) => (
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
                        ),
                      )}
                    </div>
                    <div
                      className="cycle-track"
                      style={{
                        gridTemplateColumns: `repeat(${cycleUnits},minmax(0,1fr))`,
                      }}
                    >
                      {segments.map((step) => {
                        const start =
                          Math.max(step.start, cycleStart) - cycleStart;
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
                              if (source.current) drop(step.id, source.current);
                              dragEnd();
                            }}
                            onClick={() => {
                              if (suppressClick.current) return;
                              if (step.bol === null) {
                                drop(step.id, { bol: brush });
                              } else setSelected(step.id);
                            }}
                          >
                            {step.bol ? (
                              <>
                                <span className="step-label">
                                  {continued && <ArrowRight size={12} />}{' '}
                                  {step.bol === 'Rest' ? (
                                    <Pause size={15} />
                                  ) : null}
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
            <button
              className="secondary-button"
              onClick={() =>
                attempt(() => ({
                  ...composition,
                  steps: fitComposition(
                    composition.steps,
                    composition.beatsPerCycle,
                    total + cycleUnits,
                  ),
                }))
              }
            >
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
              onClick={() =>
                attempt(() => ({
                  ...composition,
                  steps: fitComposition(
                    composition.steps,
                    composition.beatsPerCycle,
                    total - cycleUnits,
                  ),
                }))
              }
            >
              Remove last empty cycle
            </button>
          </div>
        </div>
        <aside className="step-inspector" aria-label="Selected bol settings">
          {chosen?.bol ? (
            <>
              <div className="inspector-title">
                <div>
                  <span>Selected bol</span>
                  <h3>{chosen.bol}</h3>
                </div>
                {chosen.bol !== 'Rest' && (
                  <button
                    className="preview-bol"
                    aria-label={`Preview ${chosen.bol}`}
                    onClick={() =>
                      onPreview(chosen.bol!, chosen.emphasis, chosen.units)
                    }
                  >
                    <Play size={17} />
                  </button>
                )}
              </div>
              <p className="inspector-help bol-breakdown">
                {bolDescription(chosen.bol)}
              </p>
              <label className="inspector-label" id="duration-label">
                Time before next bol
              </label>
              <Select
                value={String(chosen.units)}
                onValueChange={(value) => {
                  if (value)
                    attempt(() =>
                      changeCompositionStep(composition, chosen.id, {
                        units: Number(value),
                      }),
                    );
                }}
              >
                <SelectTrigger
                  className="taal-select"
                  aria-labelledby="duration-label"
                >
                  <SelectValue>{durationLabel(chosen.units)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 128, 256].map(
                    (units) => (
                      <SelectItem key={units} value={String(units)}>
                        {durationLabel(units)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <p className="inspector-help">
                Longer bols move the following strokes later. Extra cycles are
                added when needed.
              </p>
              <div className="emphasis-heading">
                <label id="emphasis-label">Emphasis</label>
                <strong>{Math.round(chosen.emphasis * 100)}%</strong>
              </div>
              <Slider
                aria-labelledby="emphasis-label"
                disabled={chosen.bol === 'Rest'}
                min={20}
                max={125}
                step={5}
                value={[Math.round(chosen.emphasis * 100)]}
                onValueChange={(value) => {
                  const emphasis =
                    (Array.isArray(value) ? value[0] : value) / 100;
                  attempt(() =>
                    changeCompositionStep(composition, chosen.id, { emphasis }),
                  );
                }}
              />
              <div className="emphasis-scale">
                <span>Soft</span>
                <span>Strong</span>
              </div>
              <p className="inspector-help">
                {chosen.bol === 'Rest'
                  ? 'A rest leaves space without striking either drum.'
                  : 'Emphasis changes the strength of this stroke, independently of its duration.'}
              </p>
              <div className="step-move">
                <button
                  className="secondary-button"
                  disabled={chosenIndex <= 0}
                  onClick={() => moveSelected(-1)}
                  aria-label="Move selected bol earlier"
                >
                  <ArrowLeft size={15} />
                  Earlier
                </button>
                <button
                  className="secondary-button"
                  disabled={chosenIndex === composition.steps.length - 1}
                  onClick={() => moveSelected(1)}
                  aria-label="Move selected bol later"
                >
                  Later
                  <ArrowRight size={15} />
                </button>
              </div>
              <button
                className="text-button clear-step"
                onClick={() => {
                  attempt(() =>
                    changeCompositionStep(composition, chosen.id, {
                      bol: null,
                    }),
                  );
                  setSelected(null);
                }}
              >
                <Trash2 size={14} />
                Clear this bol
              </button>
            </>
          ) : (
            <div className="inspector-empty">
              <GripVertical size={25} />
              <h3>Shape every stroke.</h3>
              <p>Select a placed bol to set its duration and emphasis.</p>
              <p>
                Give Dha two beats, play Dhin softly, or leave a rest. The next
                stroke follows your timing.
              </p>
            </div>
          )}
        </aside>
      </div>
      <div className="composition-footer">
        <div className="starter-pattern">
          <span>Start from a taal</span>
          <Select
            value={null}
            onValueChange={(value) => {
              if (value && Object.hasOwn(TAALS, value)) loadTaal(value as Taal);
            }}
          >
            <SelectTrigger aria-label="Load a taal into the composition">
              <SelectValue placeholder="Choose a pattern" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TAALS).map(([id, pattern]) => (
                <SelectItem key={id} value={id}>
                  {pattern.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="file-actions">
          <button
            className="text-button"
            onClick={() => {
              edit(
                resizeComposition(newComposition(), composition.beatsPerCycle),
                'New composition started. Undo restores your previous draft.',
              );
              setSelected(null);
            }}
          >
            <FilePlus2 size={15} />
            New composition
          </button>
          <button
            className="text-button"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(composition, null, 2)], {
                  type: 'application/json',
                }),
              );
              const a = document.createElement('a');
              a.href = url;
              a.download = `${composition.name.trim().replace(/[^a-z0-9_-]+/gi, '-') || 'taal-composition'}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            <Download size={15} />
            Export composition
          </button>
          <button
            className="text-button"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={15} />
            Import
          </button>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                if (file.size > 2_000_000)
                  throw new Error(
                    'Choose a composition file smaller than 2 MB.',
                  );
                const parsed = parseComposition(JSON.parse(await file.text()));
                edit(parsed, 'Composition imported.');
                setSelected(null);
              } catch (err) {
                setNotice(
                  err instanceof Error
                    ? err.message
                    : 'That file could not be opened.',
                );
              }
            }}
          />
        </div>
      </div>
      <p className="composer-notice" role="status" aria-live="polite">
        {notice ||
          'Phrases divide their duration between strokes. Additional articulations use approximate sample voicings; Kran uses Ke–Te–Na. Empty beats are silent.'}
      </p>
      {ghost && (
        <div
          className="drag-ghost"
          style={{ left: ghost.x + 12, top: ghost.y - 25 }}
        >
          <GripVertical size={15} />
          {ghost.label}
        </div>
      )}
    </section>
  );
}
