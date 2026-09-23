'use client';

import { Keyboard } from 'lucide-react';
import { PARTS, STROKES } from '@/lib/tabla';
import { DRUM_REGIONS, drumBolAt } from '@/lib/drum-regions';

export default function Drums({
  active,
  strike,
}: {
  active: string[];
  strike: (bol: string, emphasis?: number, units?: number) => Promise<void>;
}) {
  function hitDrum(
    event: React.PointerEvent<HTMLButtonElement>,
    side: 'bayan' | 'dayan',
  ) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const bol = drumBolAt(
      side,
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
    if (bol) void strike(bol);
  }
  return (
    <section className="instrument-panel" aria-label="Playable tabla">
      <div className="instrument-top">
        <span className="keyboard-hint">
          <Keyboard size={16} /> Use your keyboard or tap
        </span>
      </div>
      <div className="drum-labels">
        <div>
          <strong>Bayan</strong>
          <span>The bass drum</span>
        </div>
        <div>
          <strong>Dayan</strong>
          <span>The melody drum</span>
        </div>
      </div>
      <div className="tabla-stage">
        <img
          src="/images/tabla-pair.jpg"
          alt="Silver bayan and wooden dayan tabla with ivory drum heads"
          width="1653"
          height="951"
          fetchPriority="high"
        />
        <button
          className={`drum-hit bayan ${active.some((b) => ['Ge', 'Ke', 'Dha', 'Dhin'].includes(b)) ? 'hit' : ''}`}
          aria-label="Play bayan: center Ke, surrounding head Ge"
          onPointerDown={(e) => hitDrum(e, 'bayan')}
          onClick={(e) => {
            if (e.detail === 0) void strike('Ge');
          }}
        >
          {DRUM_REGIONS.bayan.map((region) => (
            <span
              key={region.bol}
              className={
                active.some((bol) => PARTS[bol]?.includes(region.voice))
                  ? 'region-active'
                  : ''
              }
              style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%` }}
            >
              {region.bol}
            </span>
          ))}
        </button>
        <button
          className={`drum-hit dayan ${active.some((b) => !['Ge', 'Ke'].includes(b)) ? 'hit' : ''}`}
          aria-label="Play dayan: center Te, upper center Tun, middle ring Tin, rim Na"
          onPointerDown={(e) => hitDrum(e, 'dayan')}
          onClick={(e) => {
            if (e.detail === 0) void strike('Na');
          }}
        >
          {DRUM_REGIONS.dayan.map((region) => (
            <span
              key={region.bol}
              className={
                active.some((bol) => PARTS[bol]?.includes(region.voice))
                  ? 'region-active'
                  : ''
              }
              style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%` }}
            >
              {region.bol}
            </span>
          ))}
        </button>
      </div>
      <div className="stage-caption">
        <span className="caption-line" />
        Tap a drum. Start a conversation.
        <span className="caption-line" />
      </div>
      <div className="stroke-deck">
        <div className="deck-heading">
          <h2>
            The strokes <span> / bols</span>
          </h2>
          <span>Make them your own</span>
        </div>
        <div className="stroke-pads">
          {STROKES.map((s) => (
            <button
              className={`stroke-pad ${active.includes(s.bol) ? 'hit' : ''}`}
              key={s.bol}
              aria-label={`Play ${s.bol}, ${s.note}, key ${s.key}`}
              aria-keyshortcuts={s.key.toLowerCase()}
              onPointerDown={(e) => {
                e.preventDefault();
                void strike(s.bol);
              }}
              onClick={(e) => {
                if (e.detail === 0) void strike(s.bol);
              }}
            >
              <kbd>{s.key}</kbd>
              <strong>{s.bol}</strong>
              <span>{s.note}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
