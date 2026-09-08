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
