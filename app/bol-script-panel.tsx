'use client';

import { Undo2 } from 'lucide-react';
import AutoTextarea from './auto-textarea';

export default function BolScriptPanel({
  script,
  setScript,
  scriptError,
  setScriptError,
  hasNotes,
  onCopyTimeline,
  onApply,
  previousText,
  onRestoreText,
}: {
  script: string;
  setScript: (text: string) => void;
  scriptError: string;
  setScriptError: (message: string) => void;
  hasNotes: boolean;
  onCopyTimeline: () => void;
  onApply: (replace: boolean) => void;
  previousText: string | null;
  onRestoreText: () => void;
}) {
  return (
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
      <AutoTextarea
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
          onClick={onCopyTimeline}
        >
          Current timeline → text
        </button>
        <button
          className="primary-button"
          disabled={!script.trim()}
          onClick={() => onApply(false)}
        >
          Add to composition
        </button>
        <button
          className="secondary-button"
          disabled={!script.trim()}
          onClick={() => onApply(true)}
        >
          Replace composition
        </button>
        {previousText !== null && (
          <button className="secondary-button" onClick={onRestoreText}>
            <Undo2 size={15} />
            Undo text replacement
          </button>
        )}
        <span>Copying to text does not change your timeline.</span>
      </div>
    </details>
  );
}
