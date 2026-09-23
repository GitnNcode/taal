'use client';
import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import ComposerAssistant from './composer-assistant';
import BolPalette from './bol-palette';
import BolScriptPanel from './bol-script-panel';
import ComposerFooter from './composer-footer';
import ComposerTimeline from './composer-timeline';
import ComposerToolbar from './composer-toolbar';
import StepInspector from './step-inspector';
import { useComposerDrag, type Source } from './use-composer-drag';
import { useCompositionDraft } from './use-composition-draft';
import {
  TAALS,
  newComposition,
  fitComposition,
  compositionUnits,
  compositionTimeline,
  compositionStep,
  placeCompositionStep,
  changeCompositionStep,
  resizeComposition,
  parseBolScript,
  formatBolScript,
  type Composition,
  type CompositionStep,
  type Taal,
} from '@/lib/tabla';

export default function CompositionMaker({
  audioReady,
  bpm,
  setBpm,
  playing,
  position,
  onPlay,
  onStop,
  onEdit,
  onChange,
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
  onChange: (composition: Composition) => void;
  onPreview: (bol: string, emphasis?: number, units?: number) => void;
  recording: boolean;
  onRecord: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [brush, setBrush] = useState<CompositionStep['bol']>('Dha');
  const [script, setScript] = useState('');
  const [scriptError, setScriptError] = useState('');
  const [previousText, setPreviousText] = useState<string | null>(null);
  const {
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
  } = useCompositionDraft({ bpm, script, setBpm, setScript, onEdit, onChange });
  const { dragEnd, dragEvents, ghost, over, setOver, source, suppressClick } =
    useComposerDrag(drop);
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
  function undo() {
    const previous = history.at(-1);
    if (previous) {
      onEdit();
      restore(previous.composition);
      if (previous.bpm !== undefined) setBpm(previous.bpm);
      if (previous.script !== undefined) {
        setScript(previous.script);
        setScriptError('');
      }
      setCycleInput(String(previous.composition.beatsPerCycle));
      setHistory((old) => old.slice(0, -1));
      setSelected(null);
      setNotice('Last change undone.');
    }
  }
  function commitCycle(beats: number) {
    if (beats !== composition!.beatsPerCycle)
      attempt(
        () => resizeComposition(composition!, beats),
        'Cycle length updated; your bols have been kept.',
      );
    setCycleInput(String(current.current!.beatsPerCycle));
  }
  function setCycleCount(units: number) {
    attempt(() => ({
      ...composition!,
      steps: fitComposition(
        composition!.steps,
        composition!.beatsPerCycle,
        units,
      ),
    }));
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
      <ComposerToolbar
        name={composition.name}
        setName={(name) => {
          setComposition({ ...composition, name });
        }}
        cycleInput={cycleInput}
        setCycleInput={setCycleInput}
        onCommitCycle={commitCycle}
        bpm={bpm}
        setBpm={setBpm}
        canUndo={!!history.length}
        onUndo={undo}
        audioReady={audioReady}
        playing={playing}
        hasNotes={hasNotes}
        onPlay={() => onPlay(composition)}
        onStop={onStop}
        recording={recording}
        onRecord={onRecord}
      />
      <BolScriptPanel
        script={script}
        setScript={setScript}
        scriptError={scriptError}
        setScriptError={setScriptError}
        hasNotes={hasNotes}
        onCopyTimeline={() => {
          setScript(formatBolScript(composition.steps));
          setScriptError('');
          setNotice('Current timeline copied to the text box.');
        }}
        onApply={applyScript}
        previousText={previousText}
        onRestoreText={() => {
          if (previousText === null) return;
          setScript(previousText);
          setPreviousText(null);
          setScriptError('');
          setNotice('Previous typed draft restored.');
        }}
      />
      <div className="composer-body">
        <div className="composition-workspace">
          <BolPalette
            brush={brush}
            setBrush={setBrush}
            onPreview={onPreview}
            dragEvents={dragEvents}
            suppressClick={suppressClick}
            cycles={cycles}
            total={total}
          />
          <ComposerTimeline
            composition={composition}
            timeline={timeline}
            total={total}
            cycles={cycles}
            cycleUnits={cycleUnits}
            playing={playing}
            position={position}
            selected={selected}
            setSelected={setSelected}
            activeId={activeId}
            brush={brush}
            over={over}
            setOver={setOver}
            source={source}
            suppressClick={suppressClick}
            dragEvents={dragEvents}
            onDrop={drop}
            dragEnd={dragEnd}
            onAddCycle={() => setCycleCount(total + cycleUnits)}
            onRemoveCycle={() => setCycleCount(total - cycleUnits)}
          />
        </div>
        <StepInspector
          chosen={chosen}
          chosenIndex={chosenIndex}
          stepCount={composition.steps.length}
          onPreview={onPreview}
          onChangeStep={(patch) => {
            attempt(() =>
              changeCompositionStep(composition, chosen!.id, patch),
            );
          }}
          onMove={moveSelected}
          onClear={() => {
            attempt(() =>
              changeCompositionStep(composition, chosen!.id, { bol: null }),
            );
            setSelected(null);
          }}
        />
      </div>
      <ComposerFooter
        composition={composition}
        onLoadTaal={loadTaal}
        onNew={() => {
          edit(
            resizeComposition(newComposition(), composition.beatsPerCycle),
            'New composition started. Undo restores your previous draft.',
          );
          setSelected(null);
        }}
        onImport={(parsed) => {
          edit(parsed, 'Composition imported.');
          setSelected(null);
        }}
        onNotice={setNotice}
      />
      <p className="composer-notice" role="status" aria-live="polite">
        {notice ||
          'Phrases divide their duration between strokes. Additional articulations use approximate sample voicings; Kran uses Ke–Te–Na. Empty beats are silent.'}
      </p>
      <ComposerAssistant
        composition={composition}
        script={script}
        bpm={bpm}
        onUseText={(text) => {
          setPreviousText(script);
          setScript(text);
          setScriptError('');
          const details = document
            .getElementById('bol-script-input')
            ?.closest('details');
          if (details) details.open = true;
          document
            .getElementById('bol-script-input')
            ?.scrollIntoView({ block: 'center' });
          setNotice(
            'AI proposal copied to the text box. Your timeline is unchanged.',
          );
        }}
        onApply={(next, tempo, text) => {
          edit(
            next,
            `AI composition applied at ${tempo} BPM with ${next.beatsPerCycle} beats per cycle. Undo restores your previous draft, cycle, and tempo.`,
            { bpm, script },
          );
          setBpm(tempo);
          setScript(text);
          setScriptError('');
          setSelected(null);
        }}
      />
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
