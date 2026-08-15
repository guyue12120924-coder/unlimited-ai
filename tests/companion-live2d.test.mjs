import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("public/index.html");
const boot = read("public/boot-diagnostics.js");
const runtime = read("public/companion-live2d.js");
const runtimeCss = read("public/companion-live2d.css");
const interaction = read("public/companion-live2d-interaction.js");
const interactionCss = read("public/companion-live2d-interaction.css");
const voice = read("public/companion-live2d-voice.js");
const neuralVoice = read("public/companion-live2d-neural-voice.js");
const voiceInput = read("public/companion-voice-input.js");
const callMode = read("public/companion-call-mode.js");
const callModeCss = read("public/companion-call-mode.css");
const modelPool = read("public/companion-live2d-model-pool.js");
const modelPoolCss = read("public/companion-live2d-model-pool.css");
const poolConfig = JSON.parse(read("public/live2d/model-pool.json"));
const polish = read("public/companion-live2d-polish.js");
const polishCss = read("public/companion-live2d-polish.css");
const emotion = read("public/companion-live2d-emotion-engine.js");
const emotionCss = read("public/companion-live2d-emotion-engine.css");
const uxHardening = read("public/companion-v12-ux-hardening.js");
const uxHardeningCss = read("public/companion-v12-ux-hardening.css");
const themeLoader = read("public/companion-v12-phase4-themes.js");
const galaxy = read("public/companion-v12-galaxy.js");
const wrangler = read("wrangler.toml");
const workerVoice = read("src/worker-voice.js");
const tts = read("src/tts.js");
const stt = read("src/stt.js");
const config = JSON.parse(read("public/live2d/characters.json"));
const readme = read("public/live2d/README.md");

// V12.23 must be browser-visible and boot the UX hardening layer last.
assert.match(index, /2026-08-15-v12\.23-ux-hardening-\d+/);
assert.match(index, /boot-diagnostics\.js\?v=20260815-v12\.23-ux-hardening-\d+/);
assert.match(boot, /v12\.23-ux-hardening/);
for (const asset of [
  "companion-live2d.css","companion-live2d.js","companion-live2d-voice.css","companion-live2d-voice.js",
  "companion-live2d-neural-voice.css","companion-live2d-neural-voice.js","companion-voice-input.css","companion-voice-input.js",
  "companion-call-mode.css","companion-call-mode.js","companion-live2d-model-pool.css","companion-live2d-model-pool.js",
  "companion-live2d-polish.css","companion-live2d-polish.js","companion-live2d-emotion-engine.css","companion-live2d-emotion-engine.js",
  "companion-v12-ux-hardening.css","companion-v12-ux-hardening.js"
]) assert.ok(boot.includes(asset), `boot is missing ${asset}`);
assert.match(boot, /companionLive2dModelPoolReady/);
assert.match(boot, /companionLive2dEmotionReady/);
assert.match(boot, /companionLive2dPolishReady/);
assert.match(boot, /companionV123UxHardeningReady/);

// V12.23 final UX ownership: sidebar collapse, role-menu stacking, stable immersive mode and neural voice toggle.
assert.match(uxHardening, /v12\.23-ux-hardening-2/);
assert.match(uxHardening, /uai_companion_sidebar_collapsed_v1/);
assert.match(uxHardening, /function setSidebarCollapsed\(/);
assert.match(uxHardening, /\.uai-c-v121-brand > button/);
assert.match(uxHardening, /uai-c-v123-sidebar-collapsed/);
assert.match(uxHardening, /function syncRoleMenu\(/);
assert.match(uxHardening, /uai-c-v123-role-menu-open/);
assert.match(uxHardening, /function setImmersive\(/);
assert.match(uxHardening, /const changed = root\.classList\.contains\("uai-c-v11-immersive"\) !== next/);
assert.match(uxHardening, /uai-c-v123-layout-switching/);
assert.match(uxHardening, /stopImmediatePropagation/);
assert.match(uxHardening, /function suppressLegacyRenderers\(/);
assert.match(uxHardening, /uai-c-v121-sparkle-layer, \.uai-c-v12-galaxy-layer/);
assert.match(uxHardening, /function toggleVoice\(/);
assert.match(uxHardening, /UnlimitedCompanionNeuralVoice/);
assert.match(uxHardening, /neuralToggle\.disabled = false/);
assert.match(uxHardening, /v123PointerToggle/);
assert.match(uxHardening, /window\.UnlimitedCompanionV123UXHardening/);
assert.match(uxHardeningCss, /uai-c-v123-role-menu-open/);
assert.match(uxHardeningCss, /background:linear-gradient\(160deg,#211a47/);
assert.match(uxHardeningCss, /z-index:160!important/);
assert.match(uxHardeningCss, /uai-c-v123-sidebar-collapsed/);
assert.match(uxHardeningCss, /grid-template-columns:76px minmax\(0,1fr\) 330px!important/);
assert.match(uxHardeningCss, /uai-c-v11-immersive \.uai-c-v12-sidepanel/);
assert.match(uxHardeningCss, /uai-c-v123-modern-scene \.uai-c-v121-sparkle-layer/);
assert.match(uxHardeningCss, /#uaiCompanionNeuralVoiceToggle/);

// Stable Live2D runtime + model-aware V12.18 lip sync, including legacy uppercase Cubism parameter IDs.
assert.match(runtime, /v12\.18-live2d-lipsync/);
assert.match(runtime, /pixi-live2d-display@0\.4\.0/);
assert.match(runtime, /function resolveLipSyncIds\(/);
assert.match(runtime, /motionManager\?\.lipSyncIds/);
assert.match(runtime, /getLipSyncParameters/);
assert.match(runtime, /ParamMouthOpenY/);
assert.match(runtime, /ParamA/);
assert.match(runtime, /PARAM_MOUTH_OPEN_Y/);
assert.match(runtime, /beforeModelUpdate/);
assert.match(runtime, /function applyMouthFrame\(/);
assert.match(runtime, /getLipSyncStatus/);
assert.match(runtime, /setModelForCharacter/);
assert.match(runtime, /clearModelForCharacter/);
assert.match(runtime, /window\.UnlimitedCompanionLive2D/);
assert.match(runtimeCss, /z-index:6!important/);
assert.match(runtimeCss, /uaiLive2DAura/);

// Presence bridge still classifies the reply and routes emotions through Live2D.setEmotion.
assert.match(interaction, /function classifyEmotion\(/);
for (const name of ["happy","shy","caring","sad","angry","thinking"]) assert.ok(interaction.includes(name), `presence bridge missing ${name}`);
assert.match(interaction, /api\(\)\?\.setEmotion/);
assert.match(interaction, /playMotion\?\.\("TapBody"/);
assert.match(interactionCss, /data-v129-live2d-emotion="caring"/);
for (const marker of [
  "value.days >= 7 && value.messages >= 180 && value.sessions >= 8",
  "value.days >= 3 && value.messages >= 70 && value.sessions >= 4",
  "value.messages >= 20 || value.sessions >= 2"
]) {
  assert.ok(galaxy.includes(marker), `galaxy relationship stage is missing: ${marker}`);
  assert.ok(interaction.includes(marker), `Live2D relationship stage drifted: ${marker}`);
}

// TTS/STT/call loop remain intact.
assert.match(voice, /SpeechSynthesisUtterance/);
assert.match(voice, /createAnalyser/);
assert.match(voice, /getByteTimeDomainData/);
assert.match(neuralVoice, /\/api\/companion\/tts/);
assert.match(neuralVoice, /new Audio\(url\)/);
assert.match(neuralVoice, /attachAudio\?\.\(audio/);
assert.match(neuralVoice, /function replay\(/);
assert.match(neuralVoice, /function stop\(/);
assert.match(voiceInput, /MediaRecorder/);
assert.match(voiceInput, /\/api\/companion\/stt/);
assert.match(voiceInput, /noiseSuppression: true/);
assert.match(callMode, /v12\.17-call-mode-\d+/);
assert.match(callMode, /autoSend: true/);
assert.match(callMode, /autoListen: true/);
for (const voiceId of ["ara","eve","sal","rex","leo"]) assert.ok(callMode.includes(voiceId), `missing Grok voice ${voiceId}`);
assert.match(callMode, /setModelForCharacter/);
assert.match(callModeCss, /uai-c-v17-call-bar/);

// V12.22 curated model pool: exact user selection, stable automatic allocation, Haru retirement migration.
assert.match(modelPool, /v12\.22-curated-live2d-pool-1/);
assert.match(modelPool, /\/live2d\/model-pool\.json/);
assert.match(modelPool, /uai_companion_characters_v1/);
assert.match(modelPool, /uai_companion_live2d_assignments_v1/);
assert.match(modelPool, /function automaticPool\(/);
assert.match(modelPool, /autoEligible/);
assert.match(modelPool, /function chooseLeastUsed\(/);
assert.match(modelPool, /const alreadyCounted/);
assert.match(modelPool, /counts\[selected\.id\]/);
assert.match(modelPool, /name === "李萌"/);
assert.match(modelPool, /selected = mao/);
assert.match(modelPool, /autoPoolId/);
assert.match(modelPool, /poolManualId/);
assert.match(modelPool, /function migrateRetiredAssignments\(/);
assert.match(modelPool, /HARU_URL/);
assert.match(modelPool, /poolManualId === "haru"/);
assert.match(modelPool, /poolManualId: "shizuku"/);
assert.match(modelPool, /migratedFrom: "haru"/);
assert.match(modelPool, /function setManualModel\(/);
assert.match(modelPool, /function setAuto\(/);
assert.match(modelPool, /UnlimitedCompanionLive2D\?\.refresh/);
assert.match(modelPool, /UnlimitedCompanionLive2DEmotionEngine\?\.refresh/);
assert.match(modelPool, /uaiCompanionV21ModelPoolPanel/);
assert.match(modelPool, /data-v21-model/);
assert.match(modelPool, /当前精选 8 个 Live2D/);
assert.match(modelPool, /window\.UnlimitedCompanionLive2DModelPool/);
assert.match(modelPoolCss, /uai-c-v21-model-pool/);
assert.match(modelPoolCss, /uai-c-v21-status/);

assert.equal(poolConfig.version, 2);
assert.equal(poolConfig.models.length, 8, "curated pool must contain exactly eight selected appearances");
const expectedIds = ["mao","shizuku","hiyori","rice","miara","epsilon","hibiki","tsumiki"];
assert.deepEqual(poolConfig.models.map((item) => item.id), expectedIds);
assert.deepEqual(poolConfig.models.map((item) => item.catalogNo), [1,6,3,4,5,7,9,10]);
const poolIds = new Set(poolConfig.models.map((item) => item.id));
for (const retired of ["haru","izumi","miku","hatsune-miku","unitychan","unity-chan"]) {
  assert.equal(poolIds.has(retired), false, `retired candidate must not remain in pool: ${retired}`);
}
for (const item of poolConfig.models) {
  assert.match(item.model, /^https:\/\/cdn\.jsdelivr\.net\/gh\//);
  assert.match(item.model, /\.model3\.json$/);
  assert.match(String(item.sample?.owner || ""), /Live2D Inc\./);
  assert.ok(item.position?.height > 0);
}
assert.match(poolConfig.models.find((item) => item.id === "mao")?.model || "", /\/Mao\/Mao\.model3\.json$/);
assert.match(poolConfig.models.find((item) => item.id === "shizuku")?.model || "", /\/shizuku\/shizuku\.model3\.json$/);
assert.match(poolConfig.models.find((item) => item.id === "hiyori")?.model || "", /\/Hiyori\/Hiyori\.model3\.json$/);
assert.match(poolConfig.models.find((item) => item.id === "rice")?.model || "", /\/Rice\/Rice\.model3\.json$/);
assert.match(poolConfig.models.find((item) => item.id === "miara")?.model || "", /\/miara\/miara_pro_t04\.model3\.json$/);
assert.match(poolConfig.models.find((item) => item.id === "epsilon")?.model || "", /\/epsilon\/Epsilon\.model3\.json$/);
assert.match(poolConfig.models.find((item) => item.id === "hibiki")?.model || "", /\/hibiki\/hibiki\.model3\.json$/);
assert.match(poolConfig.models.find((item) => item.id === "tsumiki")?.model || "", /\/tsumiki\/tsumiki\.model3\.json$/);
assert.equal(poolConfig.models.find((item) => item.id === "shizuku")?.autoEligible, false);
assert.equal(poolConfig.models.find((item) => item.id === "tsumiki")?.autoEligible, false);
assert.equal(poolConfig.models.filter((item) => item.autoEligible !== false).length, 6, "six normal auto slots should cover the six-character product limit");

// V12.19 diagnostics / barge-in / per-role mouth tuning.
assert.match(polish, /v12\.19-live2d-polish/);
assert.match(polish, /mouthSensitivity/);
assert.match(polish, /function diagnostics\(/);
assert.match(polish, /lipSyncIds/);
assert.match(polish, /motionGroups/);
assert.match(polish, /expressionNames/);
assert.match(polish, /function testMouth\(/);
assert.match(polish, /function interruptAndListen\(/);
assert.match(polish, /stopImmediatePropagation/);
assert.match(polish, /data-v19-mouth-test/);
assert.match(polish, /data-v19-diagnose/);
assert.match(polishCss, /uai-c-v19-interrupt-ready/);

// V12.20 scans the actual selected model and builds a stable per-character emotion map.
assert.match(emotion, /v12\.20-live2d-emotion-engine-2/);
assert.match(emotion, /uai_companion_live2d_emotion_map_v1/);
assert.match(emotion, /function expressionsFromModel\(/);
assert.match(emotion, /function motionsFromModel\(/);
assert.match(emotion, /function lipSyncIds\(/);
assert.match(emotion, /function capabilities\(/);
assert.match(emotion, /function bestExpression\(/);
assert.match(emotion, /function bestMotion\(/);
assert.match(emotion, /function buildAutoMapping\(/);
assert.match(emotion, /semanticExpression/);
assert.match(emotion, /semanticMotion/);
for (const name of ["normal","happy","shy","caring","sad","angry","thinking"]) assert.ok(emotion.includes(name), `missing emotion ${name}`);
assert.match(emotion, /stored\.signature !== info\.signature/);
assert.match(emotion, /getMapping\(\{ rebuild: true \}\)/);
assert.match(emotion, /api\.setEmotion = \(emotion\) => applyMappedEmotion/);
assert.match(emotion, /originalPlayMotion\(rule\.motionGroup/);
assert.match(emotion, /suppressLegacyOverride/);
assert.match(emotion, /performance\.now\(\) - lastMappedAt < 420/);
assert.match(emotion, /updateFormalModelStatus/);
assert.match(emotion, /情绪映射已生成/);
assert.match(emotion, /data-v20-rebuild/);
assert.match(emotion, /data-v20-copy/);
assert.match(emotion, /copyMapping/);
assert.match(emotion, /exportMapping/);
assert.match(emotion, /window\.UnlimitedCompanionLive2DEmotionEngine/);
assert.match(emotionCss, /uai-c-v20-emotion-panel/);
assert.match(emotionCss, /data-v120-emotion-mapped="happy"/);

// Deep loader still carries the model pool and final diagnostics/emotion layers as a fallback.
assert.match(themeLoader, /v12\.21-phase4-model-pool/);
for (const asset of [
  "companion-live2d-model-pool.css","companion-live2d-model-pool.js",
  "companion-live2d-polish.css","companion-live2d-polish.js",
  "companion-live2d-emotion-engine.css","companion-live2d-emotion-engine.js"
]) assert.ok(themeLoader.includes(asset), `theme loader is missing ${asset}`);

// Worker voice stack remains isolated from existing chat Worker.
assert.match(wrangler, /main = "src\/worker-voice\.js"/);
assert.match(wrangler, /\[ai\][\s\S]*binding = "AI"/);
assert.match(workerVoice, /import worker from "\.\/worker\.js"/);
assert.match(tts, /xai\/grok-tts/);
assert.match(tts, /@cf\/myshell-ai\/melotts/);
assert.match(stt, /@cf\/openai\/whisper-large-v3-turbo/);
assert.match(stt, /vad_filter: true/);

// Existing base config remains a safe Mao fallback; V12.22 supplies curated per-role assignments above it.
assert.equal(config.version, 5);
assert.match(config.defaultModel?.model || "", /\/Samples\/Resources\/Mao\/Mao\.model3\.json$/);
assert.equal(config.defaultModel?.sample?.name, "Mao");
assert.equal(config.byName?.["李萌"]?.model, "/live2d/characters/limeng/limeng.model3.json");
assert.ok(config.byName?.["李萌"]?.fallback, "Li Meng base config must retain Mao fallback");
assert.match(readme, /model pool/i);
assert.equal(fs.existsSync("public/live2d/vendor/live2dcubismcore.min.js"), false);

console.log("Companion Live2D contract passed: V12.23 UX hardening + curated eight-model pool + adaptive lip sync/emotions + voice call.");
