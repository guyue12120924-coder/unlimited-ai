import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const boot = read("public/boot-diagnostics.js");
const runtime = read("public/companion-live2d.js");
const css = read("public/companion-live2d.css");
const interaction = read("public/companion-live2d-interaction.js");
const interactionCss = read("public/companion-live2d-interaction.css");
const voice = read("public/companion-live2d-voice.js");
const voiceCss = read("public/companion-live2d-voice.css");
const themeLoader = read("public/companion-v12-phase4-themes.js");
const galaxy = read("public/companion-v12-galaxy.js");
const config = JSON.parse(read("public/live2d/characters.json"));
const readme = read("public/live2d/README.md");

assert.match(boot, /companion-live2d\.css/);
assert.match(boot, /companion-live2d\.js/);
assert.match(boot, /companion-live2d-voice\.css/);
assert.match(boot, /companion-live2d-voice\.js/);
assert.match(boot, /companionLive2dReady/);
assert.match(boot, /companionVoiceReady/);
assert.match(boot, /v12\.14-live2d-voice/);

assert.match(runtime, /v12\.11-live2d-hosted-core/);
assert.match(runtime, /uai_companion_live2d_assignments_v1/);
assert.match(runtime, /pixi\.js@6\.5\.10/);
assert.match(runtime, /pixi-live2d-display@0\.4\.0/);
assert.match(runtime, /\/live2d\/vendor\/live2dcubismcore\.min\.js/);
assert.match(runtime, /https:\/\/cubism\.live2d\.com\/sdk-web\/cubismcore\/live2dcubismcore\.min\.js/);
assert.match(runtime, /async function ensureCubismCore\(/);
assert.match(runtime, /hasLocalCore/);
assert.match(runtime, /uaiCompanionCubismCoreLocal/);
assert.match(runtime, /uaiCompanionCubismCoreOfficial/);
assert.match(runtime, /async function probeModel\(/);
assert.match(runtime, /async function selectAvailableSpec\(/);
assert.match(runtime, /spec\.fallback\?\.model/);
assert.match(runtime, /await selectAvailableSpec\(configured\)/);
assert.match(runtime, /await ensureRuntime\(\)/);
assert.match(runtime, /await loadModel\(root, character, spec, signature\)/);
assert.ok(
  runtime.indexOf("const spec = await selectAvailableSpec(configured)") < runtime.indexOf("await loadModel(root, character, spec, signature)"),
  "enhance must select an available model before it enters the heavy loadModel/runtime path"
);
assert.match(runtime, /async function loadModel[\s\S]*await ensureRuntime\(\)/);
assert.match(runtime, /data-live2d-credit/);
assert.match(runtime, /官方测试模型/);
assert.match(runtime, /autoInteract: false/);
assert.match(runtime, /idleMotionGroup/);
assert.match(runtime, /currentModel\.focus/);
assert.match(runtime, /currentModel\.tap/);
assert.match(runtime, /setEmotion/);
assert.match(runtime, /setExpression/);
assert.match(runtime, /playMotion/);
assert.match(runtime, /setMouthOpen/);
assert.match(runtime, /ticker\?\.stop/);
assert.match(runtime, /ticker\?\.start/);
assert.match(runtime, /window\.UnlimitedCompanionLive2D/);

assert.match(css, /\.uai-c-live2d-layer/);
assert.match(css, /z-index:6!important/);
assert.match(css, /uaiLive2DAura/);
assert.match(css, /grid-template-columns:minmax\(0,58%\)/);
assert.match(css, /padding-right:35%!important/);
assert.match(css, /\.uai-c-v122-portrait-wrap/);
assert.match(css, /display:none!important/);
assert.match(css, /\.uai-c-live2d-credit/);
assert.match(css, /\.uai-c-live2d-status-note/);

// Presence bridge remains loaded from the scene enhancement chain.
assert.match(themeLoader, /v12\.14-phase4-live2d-voice/);
assert.match(themeLoader, /companion-live2d-interaction\.css/);
assert.match(themeLoader, /companion-live2d-interaction\.js/);
assert.match(themeLoader, /companion-live2d-voice\.css/);
assert.match(themeLoader, /companion-live2d-voice\.js/);
assert.match(interaction, /v12\.13-live2d-presence/);
assert.match(interaction, /uai_companion_live2d_presence_v1/);
assert.match(interaction, /function classifyEmotion\(/);
assert.match(interaction, /function relationshipStage\(/);
assert.match(interaction, /function latestChatAt\(/);
assert.match(interaction, /function maybeWelcome\(/);
assert.match(interaction, /function idleReaction\(/);
assert.match(interaction, /function ensureIdleLoop\(/);
assert.match(interaction, /uai-c-live2d-speaking/);
assert.match(interaction, /uai-c-live2d-idle-reaction/);
assert.match(interaction, /setMouthOpen/);
assert.match(interaction, /playMotion\?\.\("TapBody"/);
assert.match(interaction, /playMotion\?\.\("Idle"/);
assert.match(interaction, /uai-c-live2d-burst/);
assert.match(interaction, /uai-c-live2d-presence/);
assert.match(interaction, /uaiCompanionComposerWrap\.generating/);
assert.match(interaction, /function beginVoice\(/);
assert.match(interaction, /function setVoiceLevel\(/);
assert.match(interaction, /function endVoice\(/);
assert.match(interaction, /function attachAudioElement\(/);
assert.match(interaction, /window\.UnlimitedCompanionLive2DInteraction/);

// The relationship thresholds must remain aligned with the existing right-side companion panel.
for (const marker of [
  "value.days >= 7 && value.messages >= 180 && value.sessions >= 8",
  "value.days >= 3 && value.messages >= 70 && value.sessions >= 4",
  "value.messages >= 20 || value.sessions >= 2"
]) {
  assert.ok(galaxy.includes(marker), `galaxy relationship stage is missing: ${marker}`);
  assert.ok(interaction.includes(marker), `Live2D relationship stage drifted from companion panel: ${marker}`);
}

assert.match(interactionCss, /padding-right:38%!important/);
assert.match(interactionCss, /data-v127-theme="sakura"/);
assert.match(interactionCss, /data-v127-theme="moonlight"/);
assert.match(interactionCss, /data-v127-theme="neon"/);
assert.match(interactionCss, /data-v129-live2d-emotion="caring"/);
assert.match(interactionCss, /data-v129-live2d-relation-level="4"/);
assert.match(interactionCss, /data-state="welcome"/);
assert.match(interactionCss, /data-state="idle"/);
assert.match(interactionCss, /data-state="voice"/);
assert.match(interactionCss, /uaiLive2DSpeakingAura/);
assert.match(interactionCss, /uaiLive2DIdleAura/);
assert.match(interactionCss, /uaiLive2DBurst/);
assert.doesNotMatch(interactionCss, /var\(--d[xy]\)\s*\*/);

// V12.14 browser TTS: per-character settings, automatic Chinese voice selection,
// role-play dialogue extraction, reply auto-speak and real amplitude support for future audio TTS.
assert.match(voice, /v12\.14-live2d-voice/);
assert.match(voice, /uai_companion_voice_v1/);
assert.match(voice, /SpeechSynthesisUtterance/);
assert.match(voice, /speechSynthesis\.getVoices/);
assert.match(voice, /function chooseVoice\(/);
assert.match(voice, /function extractSpeechText\(/);
assert.match(voice, /dialogueOnly/);
assert.match(voice, /function chunkSpeech\(/);
assert.match(voice, /function ensureHeaderToggle\(/);
assert.match(voice, /uaiCompanionVoiceToggle/);
assert.match(voice, /function ensureSettingsPanel\(/);
assert.match(voice, /uaiCompanionVoicePanel/);
assert.match(voice, /function attachAudio\(/);
assert.match(voice, /createMediaElementSource/);
assert.match(voice, /createAnalyser/);
assert.match(voice, /getByteTimeDomainData/);
assert.match(voice, /setVoiceLevel/);
assert.match(voice, /uaiCompanionComposerWrap\.generating/);
assert.match(voice, /window\.UnlimitedCompanionVoice/);
assert.match(voiceCss, /uai-c-v14-voice-trigger/);
assert.match(voiceCss, /uai-c-v14-voice-panel/);
assert.match(voiceCss, /uaiV14VoicePulse/);

assert.equal(config.version, 5);
assert.match(config.defaultModel?.model || "", /^https:\/\/cdn\.jsdelivr\.net\/gh\/Live2D\/CubismWebSamples@/);
assert.match(config.defaultModel?.model || "", /\/Samples\/Resources\/Mao\/Mao\.model3\.json$/);
assert.equal(config.defaultModel?.sample?.name, "Mao");
assert.equal(config.defaultModel?.position?.x, 0.80);
assert.equal(config.defaultModel?.position?.y, 1.08);
assert.equal(config.defaultModel?.position?.height, 0.98);
assert.equal(config.byName?.["李萌"]?.model, "/live2d/characters/limeng/limeng.model3.json");
assert.equal(config.byName?.["李萌"]?.idleMotionGroup, "Idle");
assert.ok(Array.isArray(config.byName?.["李萌"]?.tapMotionGroups));
const fallback = config.byName?.["李萌"]?.fallback;
assert.ok(fallback, "李萌 should have an official test fallback until the real model is provided");
assert.match(fallback.model, /^https:\/\/cdn\.jsdelivr\.net\/gh\/Live2D\/CubismWebSamples@/);
assert.match(fallback.model, /\/Samples\/Resources\/Mao\/Mao\.model3\.json$/);
assert.equal(fallback.sample?.name, "Mao");
assert.equal(fallback.sample?.owner, "Live2D Inc.");
assert.equal(fallback.position?.x, 0.80);
assert.equal(fallback.position?.height, 0.98);

assert.match(readme, /public\/live2d\/characters\/limeng/);
assert.match(readme, /live2dcubismcore\.min\.js/);
assert.match(readme, /official Live2D `Mao` sample/i);
assert.match(readme, /official hosted Cubism Core/i);
assert.match(readme, /setModelForCharacter/);

assert.equal(fs.existsSync("public/live2d/vendor/live2dcubismcore.min.js"), false);

console.log("Companion Live2D contract passed: hosted runtime + presence + browser TTS + future real-audio lip sync.");
