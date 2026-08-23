# Companion Legacy Boundary

This document defines which companion files are historical references only and must not return to the production startup chain.

Current production companion architecture:

```text
V17.5 stable core entry
  -> V17.6 safe visual polish
  -> V17.7 function pack
  -> V17.8 controls / backup
  -> V17.9 safe runtime
  -> V17.10 experience / STT
  -> V17.21 emotional voice
  -> V17.14 isolated scene
  -> V17.21 integrated Live2D
  -> V17.21 unified call
  -> V17.15 atmosphere
  -> V17.16 audio gesture guard
  -> V17.19 luminous shell
```

## Do not load in production

### Structural themes

These files changed the companion shell/grid and were a source of black/white-screen regressions during the restoration work:

```text
public/companion-v10*
public/companion-v11*
public/companion-v12*
```

Their useful ideas have been reimplemented as isolated layers. Do not re-add these files to `public/index.html`, `boot-diagnostics.js`, or a lazy loader.

### Old runtime

```text
public/companion-runtime.js
public/companion-settings.js
```

The old runtime wrapped `window.fetch` and mixed request behavior with UI/runtime concerns. Production uses `companion-runtime-safe-v179.js` plus the core companion request path instead.

### Old call / voice input stacks

```text
public/companion-call-mode.js
public/companion-call-mode.css
public/companion-voice-input.js
public/companion-voice-input.css
```

Production replacements:

```text
public/companion-experience-v1710.js
public/companion-call-suite-v1713.js
public/companion-audio-gesture-v1716.js
public/companion-voice-suite-v1711.js
```

### Old Live2D enhancement stack

Historical files include:

```text
public/companion-live2d.js
public/companion-live2d.css
public/companion-live2d-interaction.js
public/companion-live2d-interaction.css
public/companion-live2d-model-pool.js
public/companion-live2d-model-pool.css
public/companion-live2d-neural-voice.js
public/companion-live2d-neural-voice.css
public/companion-live2d-polish.js
public/companion-live2d-polish.css
public/companion-live2d-voice.js
public/companion-live2d-voice.css
public/companion-live2d-emotion-engine.js
public/companion-live2d-emotion-engine.css
```

Production Live2D is owned by:

```text
public/companion-character-stage-v1712.js
public/companion-character-stage-v1712.css
```

The current implementation reuses one renderer, integrates the character into the background, and delegates precise lip sync to the V17.21 voice engine.

### Obsolete entry / loader experiments

```text
public/companion-entry-v172.js
public/companion-entry-v173.js
public/companion-entry-v174.js
public/companion-assets-loader.js
public/companion-assets-loader-v174.js
public/companion-lazy-bridge.js
```

Production entry remains:

```text
public/companion-entry-v175.js
```

The stable rule is: core CSS + core JS must enter first; optional features must never block opening the basic chat.

## Why these files remain in the repository

They are kept temporarily for:

- regression archaeology;
- rollback reference;
- extracting isolated ideas without restoring old architecture;
- compatibility tests that explicitly assert they are not loaded.

Keeping a file does not mean it is supported by the current runtime.

## Production-chain rules

Any future companion change must preserve these rules:

1. Do not change `.uai-c-shell` or `.uai-c-main` grid structure from an optional feature layer.
2. Do not wrap or replace `window.fetch` from a companion enhancement.
3. Do not observe `document.body` with broad subtree MutationObservers for companion UI refresh.
4. Do not create a second message/composer tree.
5. Do not create a second Live2D renderer during ordinary refresh.
6. Do not let optional TTS, Live2D, scene, or call resources block core chat entry.
7. Keep legacy V10/V11/V12 files absent from `public/index.html`.
8. When reusing an old feature, port the behavior into the current isolated API instead of loading the old file.

## Current ownership map

| Capability | Current owner |
| --- | --- |
| Core chat | `companion-mode.js` |
| Entry/recovery | `companion-entry-v175.js` |
| Characters | `companion-characters-core.js` + `companion-character-editor.js` |
| Memory/search | `companion-memory.js` |
| Relationship/backup | `companion-records.js` + `companion-controls-v178.js` |
| Safe runtime | `companion-runtime-safe-v179.js` |
| STT / message helpers | `companion-experience-v1710.js` |
| Emotional TTS | `companion-voice-suite-v1711.js` |
| Scene | `companion-scene-v1714.js` |
| Live2D | `companion-character-stage-v1712.js` |
| Call | `companion-call-suite-v1713.js` |
| Atmosphere | `companion-atmosphere-v1715.js` |
| Audio gesture recovery | `companion-audio-gesture-v1716.js` |
| Final shell lighting | `companion-luminous-shell-v1719.css` |

V17.22 diagnostics should treat the legacy categories above as forbidden production delivery, not as missing features.
