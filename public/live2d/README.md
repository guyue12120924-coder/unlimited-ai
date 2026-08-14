# Companion Live2D model setup

The companion chat supports Cubism 3/4 `.model3.json` models through the browser Live2D stage.

## Recommended folder for the current 李萌 character

Place the exported model exactly like this (the names inside the folder may vary as long as `limeng.model3.json` references them correctly):

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

`public/live2d/characters.json` already maps the role name `李萌` to:

```text
/live2d/characters/limeng/limeng.model3.json
```

If the file is absent, the normal portrait UI remains active and the Live2D runtime is not loaded.

## Cubism Core

This repository intentionally does **not** commit `live2dcubismcore.min.js`.

For a self-hosted/private setup, download Cubism SDK for Web from Live2D after accepting its license and copy the included Web core file to:

```text
public/live2d/vendor/live2dcubismcore.min.js
```

The runtime prefers this local file. If it is not present, it can fall back to Live2D's official hosted Cubism Core URL.

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

These calls are best-effort because motion and expression group names depend on the model itself. Configure model-specific mappings in `characters.json`.
