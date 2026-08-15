# Companion Live2D model setup

The companion chat supports Cubism 3/4 `.model3.json` models through the browser Live2D stage.

## V12.21 automatic model pool

Companion roles no longer all share the same Live2D appearance by default. The browser loads the pool definition from:

```text
/public/live2d/model-pool.json
```

The first verified pool uses runtime files from the official `Live2D/CubismWebSamples` repository pinned to one upstream commit:

```text
Mao
Haru
Hiyori Momose
Rice Glassfield
```

The assignment layer is `public/companion-live2d-model-pool.js`.

Behavior:

- `李萌` keeps Mao automatically, because Mao is the appearance already used by the current companion UI.
- Other roles are assigned the least-used pool model, with a stable role-id hash used to break ties.
- With up to the number of unique models in the pool, automatic assignment tries to avoid duplicate appearances.
- If there are more roles than models, models are reused in balanced order.
- Automatic assignments are persisted in `uai_companion_live2d_assignments_v1`, so a refresh does not randomly change a role's appearance.
- A user-selected pool model or custom `.model3.json` URL is treated as manual and is never overwritten by automatic assignment.
- Deleting a role removes only its stale auto-generated pool assignment.
- Changing a role's model refreshes the Live2D runtime and the V12.20 emotion scanner, so lip sync / expressions / motions are rebuilt for the newly selected model.

Companion Settings → `角色外观模型` provides an `自动分配` option plus a manual model selector. The pool runtime API is also available:

```js
UnlimitedCompanionLive2DModelPool.getModels();
UnlimitedCompanionLive2DModelPool.getCurrent();
UnlimitedCompanionLive2DModelPool.setModel(characterId, "haru");
UnlimitedCompanionLive2DModelPool.setAuto(characterId);
UnlimitedCompanionLive2DModelPool.sync();
```

### Sample-data notice

The pool deliberately uses models from Live2D's official Sample Data Collection rather than random extracted game/VTuber assets. These models remain Live2D sample material and are subject to the Live2D Free Material License Agreement, Live2D Cubism Sample Data Terms of Use, and any model-specific conditions.

Do not assume that an official sample model is unrestricted character art. Before public/commercial deployment, review the current terms for the exact model and intended content. Keep the on-screen sample source/identity notice enabled.

## Base / fallback behavior

The base configuration still contains the local formal-model path for 李萌:

```text
/live2d/characters/limeng/limeng.model3.json
```

If no V12.21 local pool/manual assignment exists, the runtime follows the normal resolution order from `characters.json` and ultimately falls back to official Mao. V12.21 normally creates a local Mao pool assignment for 李萌 first, so her existing appearance is preserved without requiring a local model file.

## Optional folder for a custom local model

A custom model can still be placed like this. File names inside the folder may vary as long as the `.model3.json` references them correctly.

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

A newly loaded model no longer needs hand-written emotion mappings before it can be used.

After the `.model3.json` model becomes ready, the companion automatically scans:

- Live2D `LipSync` parameter IDs;
- expression names and expression files;
- motion groups, motion files and motion counts.

The browser then generates a per-character map for:

```text
normal
happy
shy
caring
sad
angry
thinking
```

Semantic names such as `happy`, `smile`, `shy`, `love`, `sad`, `angry` and `thinking` are preferred. Models that use generic names such as `exp_01`, `exp_02`, etc. receive a stable fallback assignment so each emotion still maps to a concrete model expression and motion when possible.

The generated mapping is stored under:

```text
uai_companion_live2d_emotion_map_v1
```

Changing the active model changes the model signature, which causes the mapping to rebuild automatically:

```text
select / assign model
→ detect LipSync parameters
→ scan expressions and motions
→ generate emotion mapping
→ patch setEmotion()
→ AI replies / calls / welcome reactions use that model's capabilities
```

In Companion Settings → Live2D interaction calibration, the UI can preview every emotion, rebuild the scan and copy the generated mapping JSON.

## Lip sync

The runtime does not assume every model uses `ParamMouthOpenY`. It first reads the model-declared LipSync group and only falls back to common parameter names when needed.

For Mao this resolves to:

```text
ParamA
```

Haru and Hiyori declare:

```text
ParamMouthOpenY
```

The mouth value is applied on the model's `beforeModelUpdate` hook so motions, expressions and physics do not immediately overwrite the audio-driven mouth value. The calibration panel also provides a per-character mouth sensitivity control and a direct `测试张嘴` action.

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

## Per-character override

The browser runtime exposes:

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

Overrides are saved in local storage under:

```text
uai_companion_live2d_assignments_v1
```

Remove an override with:

```js
UnlimitedCompanionLive2D.clearModelForCharacter("character-id");
```

## Runtime APIs

Core Live2D:

```js
UnlimitedCompanionLive2D.setEmotion("happy");
UnlimitedCompanionLive2D.setExpression("smile");
UnlimitedCompanionLive2D.playMotion("Happy");
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

The adaptive layer patches the public `setEmotion()` path, so the existing AI reply, presence, voice-call and return-greeting logic automatically benefits from the model-specific mapping without rewriting those systems.
