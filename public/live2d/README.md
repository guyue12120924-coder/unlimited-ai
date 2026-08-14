# Companion Live2D model setup

The companion chat supports Cubism 3/4 `.model3.json` models through the browser Live2D stage.

## Current behavior

The runtime first looks for the current 李萌 model at:

```text
/live2d/characters/limeng/limeng.model3.json
```

If that local model does not exist, the browser falls back to the official Live2D `Mao` sample model hosted from the Live2D `CubismWebSamples` GitHub repository. The fallback is pinned to a specific upstream commit so later upstream changes do not silently change the test model.

The Mao model is **development/test data only** in this project. When it is active, the UI displays an official-sample credit. Once a real 李萌 model exists at the local path above, it automatically takes priority and the Mao fallback/credit disappear.

## Recommended folder for the real 李萌 model

Place the exported model like this. File names inside the folder may vary as long as `limeng.model3.json` references them correctly.

```text
public/live2d/characters/limeng/
  limeng.model3.json
  limeng.moc3
  limeng.physics3.json          # optional
  limeng.pose3.json             # optional
  textures/
    texture_00.png
    ...
  motions/
    ...motion3.json
  expressions/
    ...exp3.json
```

## Cubism Core — zero manual setup

This public repository intentionally does **not** commit `live2dcubismcore.min.js`.

At runtime the companion page uses the following priority:

1. If `/live2d/vendor/live2dcubismcore.min.js` exists, use that local copy.
2. Otherwise load Live2D's official hosted Cubism Core for Web from `cubism.live2d.com`.

That means the default Cloudflare/GitHub deployment does not require the user to download the SDK or upload a Core file manually.

The official hosted Core URL currently used by the runtime is:

```text
https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js
```

A private/self-hosted deployment may still place an official SDK copy at the local path above if desired; it will automatically take priority.

## Official sample notice

The Mao fallback is a Live2D original sample used for SDK integration testing. This project keeps the sample data on Live2D's official GitHub host rather than copying the model files into this repository.

When the sample is rendered, the UI provides the short notice:

> This content uses sample data owned and copyrighted by Live2D Inc.

Before redistributing or publishing a derivative that uses Live2D sample data, review the current Live2D Free Material License Agreement and the Live2D Cubism Sample Data Terms of Use.

## Per-character override

The browser runtime exposes:

```js
UnlimitedCompanionLive2D.setModelForCharacter(
  "character-id",
  "/live2d/characters/example/example.model3.json",
  {
    idleMotionGroup: "Idle",
    position: { x: 0.74, y: 0.99, height: 0.82 }
  }
);
```

Overrides are saved in local storage under:

```text
uai_companion_live2d_assignments_v1
```

Remove an override with:

```js
UnlimitedCompanionLive2D.clearModelForCharacter("character-id");
```

## Runtime API reserved for AI reactions

```js
UnlimitedCompanionLive2D.setEmotion("happy");
UnlimitedCompanionLive2D.setExpression("smile");
UnlimitedCompanionLive2D.playMotion("Happy");
UnlimitedCompanionLive2D.setMouthOpen(0.6);
```

These calls are best-effort because motion and expression group names depend on the model. Configure model-specific mappings in `characters.json`.
