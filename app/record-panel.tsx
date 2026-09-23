'use client';

import { Circle, Download, Square } from 'lucide-react';

export default function RecordPanel({
  recording,
  seconds,
  canRecord,
  recordUrl,
  recordExt,
  onToggleRecording,
}: {
  recording: boolean;
  seconds: number;
  canRecord: boolean;
  recordUrl: string;
  recordExt: string;
  onToggleRecording: () => void;
}) {
  return (
    <section className="record-panel">
      <div className="panel-title">
        <h2>Keep the moment</h2>
        <span className={`record-time ${recording ? 'is-recording' : ''}`}>
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </span>
      </div>
      <p>Capture a phrase. Or your whole flow.</p>
      <button
        className={`record-button ${recording ? 'recording' : ''}`}
        onClick={onToggleRecording}
        disabled={!canRecord}
      >
        {recording ? (
          <Square size={12} fill="currentColor" />
        ) : (
          <Circle size={14} fill="currentColor" />
        )}
        {recording ? 'Stop recording' : 'Record session'}
      </button>
      <span className="record-footnote">
        {!canRecord
          ? 'Recording isn’t supported in this browser.'
          : recording
            ? 'Recording your session · 5-minute maximum'
            : 'Just your tabla. No microphone needed.'}
      </span>
      {recordUrl && (
        <div className="recording-result">
          <audio
            controls
            src={recordUrl}
            aria-label="Your recorded tabla session"
          />
          <a
            className="download-link"
            href={recordUrl}
            download={`taal-session.${recordExt}`}
          >
            <Download size={14} />
            Download recording
          </a>
          <p>Download to keep it. Recordings stay in this tab.</p>
        </div>
      )}
    </section>
  );
}
