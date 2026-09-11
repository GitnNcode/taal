# Taal — Tabla studio

A responsive browser tabla instrument built with React and Vinext. Play with keyboard, pointer, or multitouch; practice Teentaal, Keharwa, or Dadra at 40–240 BPM; add a metronome; record the mixed performance and download it.

## Run locally

Requires Node 22.13 or later.

```sh
npm install
npm run dev
```

Open the local URL printed by the server. Audio begins after a user gesture. The sound engine uses Web Audio with five real CC0 samples and a modeled Tin. Both-drum bols combine these voices. Attribution is in `public/audio/ATTRIBUTION.md` and the in-app sound notes.

Keyboard: A Ge, S Ke, D Na, F Tin, G Tun, H Te, J Dha, K Dhin. Space starts/stops practice outside focused controls. Drums respond differently at center and rim. Multiple keys and touches can overlap.

Recording uses MediaRecorder on the instrument output, never the microphone. Browser-supported formats are selected automatically. Recordings last up to five minutes and remain in the tab until downloaded. Switching tabs stops practice and finalizes recording. Recording is disabled with an explanation where MediaRecorder is unavailable.

## Validation

```sh
node --experimental-strip-types scripts/check-audio.mjs
npx tsc --noEmit
npm run build
```

The runnable check validates all pattern voices, tempo limits, wraparound, key uniqueness, and non-silent WAV data. Build and type checking passed. Browser interaction testing was not requested. The optional `configure_tabla_practice` WebMCP tool is feature-detected; a supported live WebMCP validation context was unavailable.

## Design

The actual instrument leads the page. Ivory skin and rawhide inform the neutral stage; indigo practice controls contrast with the wood and metal drums. Bricolage Grotesque gives the studio a compact musical character, with Manrope for controls. Layout adapts to a vertical studio on phones and supports reduced motion and visible keyboard focus.

## Composition maker

Use **Compose** to drag bols or explicit rests into the timeline and reorder placed strokes. A selected bol has independent duration (¼–64 beats) and emphasis (20–125%). Duration is the time before the next stroke; it does not pitch-shift or time-stretch a sample. Longer strokes shift subsequent material and add whole cycles without discarding notes. Set 1–64 beats per cycle, add whole cycles, or load a traditional taal as an editable starting point.

Mouse dragging uses native HTML drag and drop. Touch and pen use pointer dragging. Keyboard users can select a palette bol, activate an empty beat, and use Earlier/Later controls. Editing stops playback; tempo can change while playing. The metronome stays on the beat grid independently of note duration, and the studio recorder captures composition playback.

The latest draft saves its name, beats, tempo, and unfinished bol text together in browser localStorage. Export/import JSON preserves the full composition; Undo retains the last 30 edits in the current tab. A new composition is reversible with Undo. Composition import validates the bol, timing, cycle alignment, and emphasis fields.

Practice rhythms and compositions are rendered with `OfflineAudioContext` before playback and cached while editing. One native looping audio source plays the complete track; animation derives its position from that same track and the audio output timestamp. Background rendering preserves ringing tails across loop boundaries. Tempo and metronome changes replace the compiled track at the same musical position. A delayed animation frame catches up to the track without interrupting or rescheduling its sound. Browser/device output latency, particularly with wireless headphones, is separate from render time.

Check compiled playback with `node --experimental-strip-types scripts/check-compiled-audio.mjs` and `node --experimental-strip-types scripts/check-high-tempo.mjs`. For actual browser waveform checks while the dev server runs, temporarily copy `scripts/check-compiled-browser.html` into `public/`, open that file on localhost, then remove the copy. The check renders silently and verifies the first attack, later beat placement, rests, exact loop length, and caching.

```sh
node --experimental-strip-types scripts/check-composition.mjs
```

This check covers drag insertion/reordering, exact fractional timing, rests, cycle extension and resizing, round-trip storage, and invalid inputs.

## Extended bol library

The composition maker includes 59 entries: core strokes, common alternate names, and 26 phrases. Search the palette to find Terekete, Tirakita, Tirkit, Tetekete, Kre, Kra, Kran, Dhage, Dhatigena, Tirakitataka, Gadigena, and others. Select a placed phrase to see its stroke breakdown. Preview and composition playback both respect its duration and emphasis. A four-stroke phrase uses four evenly spaced attacks within its assigned time; Kre/Kra use a short flam. Rest remains silent.

This is a practical library, not an exhaustive catalogue of every gharana's vocabulary. Extra articulations are approximations assembled from the five original samples and modeled Tin; they are not separate authentic recordings. Kran is an explicitly labeled Ke–Te–Na approximation because a universal fingering for that spelling was not established. Individual components can also be placed separately to represent your teacher's version.

References used for the vocabulary and playback notes:
- Riyaaz Academy / Kuljit Bhamra, *The Essential Guide to Starting Out on Tabla*: https://riyaazacademy.com/wp-content/uploads/2020/04/ESSENTIAL-FREE-GUIDE-TO-TABLA.pdf — aliases and Kre as a Ke + Te flam.
- DigiTabla bol demonstrations: https://digitabla.com/reference/tabla-bols/bol-demonstrations/ — distinguishes single strokes and phrases.
- NYU Theory & Practice I: https://sites.google.com/nyu.edu/theoryandpractice1/course-content/unit-4-rhythm-meter/north-indian-taal — foundational articulations and Tirakita.

Check the extended library with `node --experimental-strip-types scripts/check-bol-library.mjs`.

## AI composition assistant

The bottom-right **Ask AI** sparkle opens a composer assistant. Connect an OpenRouter API key; the default model is `google/gemini-3.8-flash`. Connection checks the key and the model's JSON-response support without generating tokens. A different supported OpenRouter model ID can be entered in Connection.

Choose **Typed bols**, **Current timeline**, or **Something new**. The assistant receives the current text (including unapplied edits), timeline, tempo, cycle, bol library, phrase expansions, notation limits, and recent conversation. Requests go directly from the browser to OpenRouter and use the connected account's credits. Keys remain in page memory only; disconnect or reload to clear them. No server secret or environment variable is required.

Proposals are checked by the composition parser before being shown. **Use in text box** preserves the timeline and offers **Undo text replacement**. **Apply composition** stops playback, loads the proposal and tempo, and keeps the previous composition, typed draft, and tempo in Undo. If the editor changes while a request is running, the old proposal cannot overwrite it; ask for an update. Requests support cancellation and timeouts, and failed requests preserve your prompt for retry.

The bol text box grows and shrinks with text, including paste, AI proposals, responsive wrapping, and reopening its collapsed section.

```sh
node --experimental-strip-types scripts/check-composer-ai.mjs
```

This check covers response validation, prompt context, mocked OpenRouter requests/errors/cancellation, and textarea measurement behavior. It does not make a paid model call or substitute for browser interaction testing.

### Local .env connection

For automatic local connection, put `OPENROUTER_API_KEY=your-key` in the ignored `.env` file, then start/restart `npm run dev`. Optionally set `OPENROUTER_MODEL`; the default remains Gemini 3.8 Flash. Use `=`, not `:`, between the variable and its value. Refresh the page after adding the key.

The assistant detects this connection without asking you to paste the key. Local requests go through `/api/composer`, which keeps the key on the server, validates the input, rebuilds the system prompt, and returns only the proposal. The shared-key route is limited to localhost and same-origin requests; it is not enabled for hosted/public access. Connection settings still offer the browser-key flow. The `.env` file is ignored by Git and must not be committed.
