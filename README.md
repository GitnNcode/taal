# Taal

> A browser-based tabla studio for playing, practising, composing, and recording.

Taal turns your keyboard, pointer, or touchscreen into a playable tabla. Learn a traditional cycle, build your own composition from bols and phrases, ask an AI assistant for ideas, then record the result, all without installing music software.

[![Taal application icon](public/icon.svg)](public/icon.svg)

## What you can do

- **Play expressively:** trigger the bayan and dayan with a keyboard, pointer, or multitouch. Different drum regions produce different strokes, and overlapping input supports combined bols.
- **Practise a taal:** loop Teentaal, Keharwa, or Dadra with adjustable tempo, visual beat tracking, khali markers, and an optional metronome.
- **Write compositions:** arrange individual bols, phrases, and rests on a timeline; change their duration and emphasis; resize cycles; and undo edits.
- **Use a practical bol library:** search 59 core strokes, alternate names, and phrases, including Terekete, Tirakita, Kre, Dhatigena, and Gadigena.
- **Ask for ideas:** connect an OpenRouter model to create a new composition or revise the current text or timeline. Every proposal is validated before it can be applied.
- **Save and share your work:** drafts persist in local storage, compositions import and export as JSON, and the mixed audio output can be recorded and downloaded.

## Quick start

Taal requires Node.js 22.13 or newer.

```sh
git clone https://github.com/GitnNcode/taal.git
cd taal
npm install
npm run dev
```

Open the local URL printed in your terminal. Your browser will start the audio engine after the first interaction.

## Play from the keyboard

| Key | Bol  | Sound        |
| --- | ---- | ------------ |
| A   | Ge   | Open bass    |
| S   | Ke   | Closed bass  |
| D   | Na   | Rim stroke   |
| F   | Tin  | Clear ring   |
| G   | Tun  | Open tone    |
| H   | Te   | Closed tone  |
| J   | Dha  | Both drums   |
| K   | Dhin | Ringing pair |

Press `Space` to start or stop a practice loop when focus is outside an input or control.

## Compose

Open **Compose** to create a piece from scratch or load a traditional taal as a starting point.

- Drag bols and rests into the timeline with a mouse, touch, or pen.
- Use selection and Earlier/Later controls for keyboard editing.
- Set a bol's duration from a quarter beat to 64 beats and its emphasis from 20% to 125%.
- Change the cycle length, add full cycles, or adjust tempo during playback.
- Export the composition as JSON and import it later.

Phrases are expanded into playable strokes inside their assigned duration. Some extended articulations are approximations built from the available samples; the interface labels those cases instead of presenting them as universal across gharanas.

## AI composition assistant

The **Ask AI** panel can revise typed bols, work from the current timeline, or create something new. It sends the current musical context (tempo, cycle length, supported bols, and phrase expansions) to OpenRouter.

You can connect in either of two ways:

1. Enter an OpenRouter API key in the browser. The key stays in page memory and is cleared on disconnect or reload.
2. For local development, add the following to an ignored `.env` file:

   ```sh
   OPENROUTER_API_KEY=your-key
   OPENROUTER_MODEL=google/gemini-3.8-flash
   ```

   Restart the development server after changing `.env`. Local requests use the same-origin `/api/composer` route so the key remains server-side. This shared-key route is intentionally restricted to localhost.

The model is optional; playing, practice, composition, persistence, import/export, and recording work without it. AI output is treated as a proposal: it must pass the same composition parser as user-authored input, supports undo, and cannot overwrite edits made while a request is in flight.

## How it works

Taal is built with React 19, TypeScript, Vinext, Tailwind CSS, and the Web Audio API.

- Five CC0 tabla samples provide Na, Tun, Te, Ge, and Ke. Tin is modelled separately rather than relabelling Tun.
- Combined bols mix the corresponding voices through a shared audio graph.
- Practice patterns and compositions render through `OfflineAudioContext` and play as a single cached loop, preserving timing and ringing tails at cycle boundaries.
- Visual playback follows the audible output timestamp rather than the render-ahead clock, improving synchronisation across browsers and audio devices.
- `MediaRecorder` captures the app's mixed output, not the microphone, and chooses a format supported by the current browser.

## Validation

Run the type check and production build:

```sh
npx tsc --noEmit
npm run build
```

Run the focused audio, timing, composition, persistence, bol-library, and AI checks:

```sh
for check in scripts/check-*.mjs; do
  node --experimental-strip-types "$check"
done
```

The browser-only compiled waveform check lives in `scripts/check-compiled-browser.html` and is intended to run from the app's origin while the development server is active.

## Audio and vocabulary notes

The five recorded samples are CC0 recordings by [mmiron](https://freesound.org/people/mmiron/packs/8162/), sourced through the [Sonic Pi sample library](https://github.com/sonic-pi-net/sonic-pi/blob/dev/etc/samples/README.md). See [the full attribution](public/audio/ATTRIBUTION.md) for individual source links.

The extended vocabulary was informed by:

- [Riyaaz Academy: *The Essential Guide to Starting Out on Tabla*](https://riyaazacademy.com/wp-content/uploads/2020/04/ESSENTIAL-FREE-GUIDE-TO-TABLA.pdf)
- [DigiTabla: Tabla bol demonstrations](https://digitabla.com/reference/tabla-bols/bol-demonstrations/)
- [NYU: North Indian taal](https://sites.google.com/nyu.edu/theoryandpractice1/course-content/unit-4-rhythm-meter/north-indian-taal)

Taal is a creative practice tool, not an exhaustive or authoritative catalogue of every tradition or gharana.
