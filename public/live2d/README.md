# Companion Live2D model setup

The companion chat supports Cubism 3/4 `.model3.json` models through the browser Live2D stage.

## V12.22 curated model pool

The model pool is defined at:

```text
/public/live2d/model-pool.json
```

The current curated selection follows the user-approved catalog order:

```text
#1  Mao
#6  Shizuku        (replaces the former Haru slot)
#3  Hiyori Momose
#4  Rice Glassfield
#5  Miara
#7  Epsilon
#9  Hibiki
#10 Tsumiki Harugasa
```

Removed / rejected models are intentionally not part of the pool:

```text
Haru
Izumi
Hatsune Miku
Unity-chan
```

`public/companion-live2d-model-pool.js` manages per-character assignments.

Behavior:

- `李萌` keeps Mao automatically unless the user explicitly chooses another model.
- Normal automatic assignment uses the least-used eligible model and a stable role-id hash to break ties.
- Six normal automatic models are available, matching the product's six-character limit, so automatic roles can remain visually distinct.
- Automatic assignments persist in `uai_companion_live2d_assignments_v1`; refreshing the page does not randomly change faces.
- A manually selected pool model or custom `.model3.json` URL is never overwritten by automatic assignment.
- Switching models refreshes both the Live2D runtime and the V12.20 emotion scanner so lip sync, expressions and motions adapt to the new model.
- Old V12.21 Haru assignments are migrated. An explicit/manual Haru choice becomes Shizuku, as requested. An old automatic Haru assignment returns to automatic allocation instead of silently assigning a special-terms character to an arbitrary renamed role.

Companion Settings → `角色外观模型` provides automatic allocation plus all eight manual choices.

```js
UnlimitedCompanionLive2DModelPool.getModels();
UnlimitedCompanionLive2DModelPool.getCurrent();
UnlimitedCompanionLive2DModelPool.setModel(characterId, "epsilon");
UnlimitedCompanionLive2DModelPool.setAuto(characterId);
UnlimitedCompanionLive2DModelPool.sync();
```

### Runtime sources

Mao, Hiyori and Rice use runtime assets pinned from `Live2D/CubismWebSamples`.

Shizuku, Miara, Epsilon, Hibiki and Tsumiki use a pinned public GitHub mirror of the official Live2D sample packages. The model URLs are pinned to a commit so upstream changes do not silently alter the application.

### Sample-data and character terms

These are sample characters, not unrestricted original assets owned by this project. Keep the source notice enabled and review the current Live2D Free Material License, Cubism Sample Data Terms, and any character-specific terms before public/commercial deployment.

Two entries are deliberately excluded from automatic assignment:

- **Shizuku** — her model-specific conditions require keeping the Shizuku name/settings, so she is a manual choice rather than being silently assigned to a differently named AI role.
- **Tsumiki Harugasa** — a collaboration-character sample with stricter use conditions, so she is also manual-only.

Hiyori and Miara also have model-specific character-design restrictions; the project uses their exported runtime appearance without modifying the character design.

## Base / fallback behavior

The base configuration still contains the optional local-model path for 李萌:

```text
/live2d/characters/limeng/limeng.model3.json
```

If no local pool/manual assignment exists, the runtime follows `characters.json` and ultimately retains Mao as the safe base fallback. V12.22 normally creates a Mao pool assignment for 李萌 first.

## Optional folder for a custom local model

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

## Automatic model adaptation (V12.20)

Every newly loaded `.model3.json` is scanned for:

- model-declared `LipSync` parameter IDs;
- expression names/files;
- motion groups/files/counts.

The browser builds a per-character map for:

```text
normal
happy
shy
caring
sad
angry
thinking
```

Semantic names such as `happy`, `smile`, `shy`, `blushing`, `sad`, `angry` and `thinking` are preferred. Generic expression names receive stable fallback slots.

The generated mapping is stored under:

```text
uai_companion_live2d_emotion_map_v1
```

Changing the model changes its capability signature and automatically rebuilds the mapping:

```text
select model
→ detect LipSync
→ scan expressions/motions
→ build emotion mapping
→ AI replies / calls / welcome reactions use that model
```

The settings calibration panel can preview emotions, rebuild the scan, copy the generated mapping, tune mouth sensitivity and run `测试张嘴`.

## Lip sync

The runtime does not assume one mouth parameter. It reads the model-declared LipSync group first, then falls back to common Cubism IDs:

```text
ParamMouthOpenY
ParamA
PARAM_MOUTH_OPEN_Y
```

Examples in the current pool include Mao (`ParamA`), Miara (`ParamMouthOpenY`), and Shizuku/Tsumiki (`PARAM_MOUTH_OPEN_Y`). This also protects legacy models such as Hibiki that may omit an explicit LipSync group.

The mouth value is applied on `beforeModelUpdate`, after normal motion/expression work has had a chance to run, so the audio-driven mouth is not immediately overwritten.

## Cubism Core — zero manual setup

This public repository intentionally does **not** commit `live2dcubismcore.min.js`.

Runtime priority:

1. `/live2d/vendor/live2dcubismcore.min.js`, when supplied by a private/self-hosted build.
2. Live2D's official hosted Cubism Core for Web.

Current hosted fallback:

```text
https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js
```

## Per-character override

```js
UnlimitedCompanionLive2D.setModelForCharacter(
  "character-id",
  "/live2d/characters/example/example.model3.json",
  {
    idleMotionGroup: "Idle",
    position: { x: 0.80, y: 1.06, height: 0.98 }
  }
);
```

Overrides are saved under:

```text
uai_companion_live2d_assignments_v1
```

Remove one with:

```js
UnlimitedCompanionLive2D.clearModelForCharacter("character-id");
```

## Runtime APIs

Core Live2D:

```js
UnlimitedCompanionLive2D.setEmotion("happy");
UnlimitedCompanionLive2D.setExpression("smile");
UnlimitedCompanionLive2D.playMotion("Tap");
UnlimitedCompanionLive2D.setMouthOpen(0.6);
UnlimitedCompanionLive2D.getLipSyncStatus();
```

Adaptive emotion layer:

```js
UnlimitedCompanionLive2DEmotionEngine.getCapabilities();
UnlimitedCompanionLive2DEmotionEngine.getMapping();
UnlimitedCompanionLive2DEmotionEngine.rebuild();
UnlimitedCompanionLive2DEmotionEngine.previewEmotion("shy");
UnlimitedCompanionLive2DEmotionEngine.exportMapping();
```

The adaptive layer patches the public emotion path, so AI replies, presence behavior, voice calls and return greetings automatically benefit from whichever selected model is active.
