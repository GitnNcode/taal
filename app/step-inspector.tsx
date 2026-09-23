'use client';

import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Play,
  Trash2,
} from 'lucide-react';
import { bolDescription, type CompositionStep } from '@/lib/tabla';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { durationLabel } from './composer-timeline';

export default function StepInspector({
  chosen,
  chosenIndex,
  stepCount,
  onPreview,
  onChangeStep,
  onMove,
  onClear,
}: {
  chosen: CompositionStep | undefined;
  chosenIndex: number;
  stepCount: number;
  onPreview: (bol: string, emphasis?: number, units?: number) => void;
  onChangeStep: (
    patch: Partial<Pick<CompositionStep, 'bol' | 'units' | 'emphasis'>>,
  ) => void;
  onMove: (direction: -1 | 1) => void;
  onClear: () => void;
}) {
  return (
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
          <label
            className="inspector-label"
            id="duration-label"
            htmlFor="bol-duration"
          >
            Time before next bol
          </label>
          <Select
            value={String(chosen.units)}
            onValueChange={(value) => {
              if (value) onChangeStep({ units: Number(value) });
            }}
          >
            <SelectTrigger
              id="bol-duration"
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
            Longer bols move the following strokes later. Extra cycles are added
            when needed.
          </p>
          <div className="emphasis-heading">
            <span id="emphasis-label">Emphasis</span>
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
              const emphasis = (Array.isArray(value) ? value[0] : value) / 100;
              onChangeStep({ emphasis });
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
              onClick={() => onMove(-1)}
              aria-label="Move selected bol earlier"
            >
              <ArrowLeft size={15} />
              Earlier
            </button>
            <button
              className="secondary-button"
              disabled={chosenIndex === stepCount - 1}
              onClick={() => onMove(1)}
              aria-label="Move selected bol later"
            >
              Later
              <ArrowRight size={15} />
            </button>
          </div>
          <button className="text-button clear-step" onClick={onClear}>
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
  );
}
