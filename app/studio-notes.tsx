'use client';

export default function StudioNotes({ audioTiming }: { audioTiming: string }) {
  return (
    <details className="guide-details">
      <summary>Playing tips & sound notes</summary>
      <p>
        <strong>Audio timing:</strong> <output>{audioTiming}</output>. Loops are
        compiled before playback. Highlights follow the position in that track
        using the browser’s audio output clock and its reported device latency,
        whichever accounts for more delay.
      </p>
      <p>
        Use A, S, D, F, G, H, J, and K to play the labeled strokes. You can
        press multiple keys together. Tap the center or rim of each drum for
        different bols. Space starts or stops the practice rhythm when a control
        is not focused. Change the tempo as you play; choosing another taal
        stops the current cycle.
      </p>
      <p>
        The blue beat marks sam, the beginning of the cycle. An open circle
        marks khali. The metronome follows the practice rhythm. Recording
        captures your strokes, the rhythm, and the click at the current volume.
        Save a recording before reloading or closing this tab. Switching away
        from the tab stops the rhythm and recording.
      </p>
      <p>
        Na, Tun, Te, Ge, and Ke use real CC0 tabla recordings by mmiron,
        distributed with{' '}
        <a
          href="https://github.com/sonic-pi-net/sonic-pi/blob/dev/etc/samples/README.md"
          target="_blank"
          rel="noreferrer"
        >
          Sonic Pi
        </a>
        . Tin is a synthesized membrane tone; Dha and Dhin combine the
        corresponding bass and treble voices. Rhythm patterns use simplified
        articulations: Ta → Na, Ti → Te, Ka → Ke, Dhi → Dhin.{' '}
        <a href="/audio/ATTRIBUTION.md">Audio sources & license</a>.
      </p>
    </details>
  );
}
