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
const neuralVoice = read("public/companion-live2d-neural-voice.js");
const neuralVoiceCss = read("public/companion-live2d-neural-voice.css");
const voiceInput = read("public/companion-voice-input.js");
const voiceInputCss = read("public/companion-voice-input.css");
const themeLoader = read("public/companion-v12-phase4-themes.js");
const galaxy = read("public/companion-v12-galaxy.js");
const wrangler = read("wrangler.toml");
const workerVoice = read("src/worker-voice.js");
const tts = read("src/tts.js");
const stt = read("src/stt.js");
const config = JSON.parse(read("public/live2d/characters.json"));
const readme = read("public/live2d/README.md");

// V12.16 must be directly visible from the top-level boot chain so stale deep loaders
// cannot hide the new voice features after a Cloudflare deployment.
assert.match(boot, /v12\.16-voice-conversation/);
for (const asset of [
  "companion-live2d.css",
  "companion-live2d.js",
  "companion-live2d-voice.css",
  "companion-live2d-voice.js",
  "companion-live2d-neural-voice.css",
  "companion-live2d-neural-voice.js",
  "companion-voice-input.css",
  "companion-voice-input.js"
]) assert.ok(boot.includes(asset), `boot is missing ${asset}`);
assert.match(boot, /companionLive2dReady/);
assert.match(boot, /companionVoiceReady/);
assert.match(boot, /companionNeuralVoiceReady/);
assert.match(boot, /companionVoiceInputReady/);

// Stable Live2D runtime contract.
assert.match(runtime, /v12\.11-live2d-hosted-core/);
assert.match(runtime, /uai_companion_live2d_assignments_v1/);
assert.match(runtime, /pixi\.js@6\.5\.10/);
assert.match(runtime, /pixi-live2d-display@0\.4\.0/);
assert.match(runtime, /\/live2d\/vendor\/live2dcubismcore\.min\.js/);
assert.match(runtime, /https:\/\/cubism\.live2d\.com\/sdk-web\/cubismcore\/live2dcubismcore\.min\.js/);
assert.match(runtime, /async function ensureCubismCore\(/);
assert.match(runtime, /async function probeModel\(/);
assert.match(runtime, /async function selectAvailableSpec\(/);
assert.match(runtime, /spec\.fallback\?\.model/);
assert.match(runtime, /await selectAvailableSpec\(configured\)/);
assert.match(runtime, /await ensureRuntime\(\)/);
assert.match(runtime, /await loadModel\(root, character, spec, signature\)/);
assert.ok(
  runtime.indexOf("const spec = await selectAvailableSpec(configured)") < runtime.indexOf("await loadModel(root, character, spec, signature)"),
  "enhance must select an available model before entering the heavy runtime path"
);
for (const api of ["setEmotion", "setExpression", "playMotion", "setMouthOpen"]) assert.match(runtime, new RegExp(api));
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

// Presence and all voice layers stay in the scene enhancement chain as a fallback
// even though V12.16 also exposes them directly from boot.
assert.match(themeLoader, /v12\.16-phase4-voice-conversation/);
for (const asset of [
  "companion-live2d-interaction.css",
  "companion-live2d-interaction.js",
  "companion-live2d-voice.css",
  "companion-live2d-voice.js",
  "companion-live2d-neural-voice.css",
  "companion-live2d-neural-voice.js",
  "companion-voice-input.css",
  "companion-voice-input.js"
]) assert.ok(themeLoader.includes(asset), `theme loader is missing ${asset}`);

assert.match(interaction, /v12\.13-live2d-presence/);
for (const marker of [
  "function classifyEmotion(",
  "function relationshipStage(",
  "function maybeWelcome(",
  "function idleReaction(",
  "function ensureIdleLoop(",
  "function beginVoice(",
  "function setVoiceLevel(",
  "function endVoice(",
  "function attachAudioElement("
]) assert.ok(interaction.includes(marker), `presence bridge missing ${marker}`);
assert.match(interaction, /setMouthOpen/);
assert.match(interaction, /window\.UnlimitedCompanionLive2DInteraction/);

for (const marker of [
  "value.days >= 7 && value.messages >= 180 && value.sessions >= 8",
  "value.days >= 3 && value.messages >= 70 && value.sessions >= 4",
  "value.messages >= 20 || value.sessions >= 2"
]) {
  assert.ok(galaxy.includes(marker), `galaxy relationship stage is missing: ${marker}`);
  assert.ok(interaction.includes(marker), `Live2D relationship stage drifted: ${marker}`);
}
assert.match(interactionCss, /padding-right:38%!important/);
assert.match(interactionCss, /data-v129-live2d-emotion="caring"/);
assert.match(interactionCss, /data-v129-live2d-relation-level="4"/);
assert.doesNotMatch(interactionCss, /var\(--d[xy]\)\s*\*/);

// V12.14 browser TTS remains the no-server fallback and real-audio analyser.
assert.match(voice, /v12\.14-live2d-voice/);
assert.match(voice, /SpeechSynthesisUtterance/);
assert.match(voice, /speechSynthesis\.getVoices/);
assert.match(voice, /function extractSpeechText\(/);
assert.match(voice, /function attachAudio\(/);
assert.match(voice, /createMediaElementSource/);
assert.match(voice, /createAnalyser/);
assert.match(voice, /getByteTimeDomainData/);
assert.match(voice, /setVoiceLevel/);
assert.match(voice, /window\.UnlimitedCompanionVoice/);
assert.match(voiceCss, /uai-c-v14-voice-trigger/);

// V12.15 neural voice: Cloudflare audio first, system fallback, real waveform lips,
// robust cancellation/replay and per-character migration.
assert.match(neuralVoice, /v12\.15-neural-voice-3/);
assert.match(neuralVoice, /uai_companion_neural_voice_v1/);
assert.match(neuralVoice, /\/api\/companion\/tts\/status/);
assert.match(neuralVoice, /fetch\("\/api\/companion\/tts"/);
assert.match(neuralVoice, /response\.blob\(\)/);
assert.match(neuralVoice, /new Audio\(url\)/);
assert.match(neuralVoice, /attachAudio\?\.\(audio/);
assert.match(neuralVoice, /const migratedCharacters = new Set\(\)/);
assert.match(neuralVoice, /lastBlobs = \[\]/);
assert.match(neuralVoice, /lastNeuralCheckAt/);
assert.match(neuralVoice, /neuralStatus = "verified"/);
assert.match(neuralVoice, /Date\.now\(\) - lastNeuralCheckAt > 30000/);
assert.match(neuralVoice, /function watchSystemSpeech\(/);
assert.match(neuralVoice, /audio\.addEventListener\("pause"/);
assert.match(neuralVoice, /audio\.addEventListener\("emptied"/);
assert.match(neuralVoice, /function replay\(/);
assert.match(neuralVoice, /function stop\(/);
assert.match(neuralVoice, /AbortController/);
assert.match(neuralVoice, /fallbackSystem/);
assert.match(neuralVoice, /provider: "auto"/);
assert.match(neuralVoice, /window\.UnlimitedCompanionNeuralVoice/);
assert.match(neuralVoiceCss, /uai-c-v15-neural-voice-ready/);
assert.match(neuralVoiceCss, /data-state="verified"/);
assert.match(neuralVoiceCss, /data-v15-neural-voice-state="speaking"/);

// V12.16 microphone input: explicit user gesture -> MediaRecorder -> Whisper ->
// editable composer text. Recognition must never auto-send.
assert.match(voiceInput, /v12\.16-voice-input-2/);
assert.match(voiceInput, /MAX_RECORD_MS = 30000/);
assert.match(voiceInput, /navigator\.mediaDevices\?\.getUserMedia/);
assert.match(voiceInput, /window\.MediaRecorder/);
assert.match(voiceInput, /getUserMedia\(\{/);
assert.match(voiceInput, /echoCancellation: true/);
assert.match(voiceInput, /noiseSuppression: true/);
assert.match(voiceInput, /\/api\/companion\/stt/);
assert.match(voiceInput, /transcribeController/);
assert.match(voiceInput, /discardNextRecording/);
assert.match(voiceInput, /scheduleIdle/);
assert.match(voiceInput, /setHtmlIfChanged/);
assert.match(voiceInput, /uaiCompanionMicButton/);
assert.match(voiceInput, /#uaiCompanionInput/);
assert.match(voiceInput, /dispatchEvent\(new Event\("input"/);
assert.doesNotMatch(voiceInput, /uaiCompanionSend|\.click\(\).*send/i, "speech recognition must not auto-send user text");
assert.match(voiceInput, /window\.UnlimitedCompanionVoiceInput/);
assert.match(voiceInputCss, /uai-c-v16-mic/);
assert.match(voiceInputCss, /uaiV16MicRecording/);
assert.match(voiceInputCss, /uaiV16MicLoading/);

// Worker binding and voice endpoints stay isolated from the existing chat Worker.
assert.match(wrangler, /main = "src\/worker-voice\.js"/);
assert.match(wrangler, /\[ai\][\s\S]*binding = "AI"/);
assert.match(workerVoice, /import worker from "\.\/worker\.js"/);
assert.match(workerVoice, /handleCompanionTts/);
assert.match(workerVoice, /handleCompanionStt/);
assert.match(workerVoice, /\/api\/companion\/tts/);
assert.match(workerVoice, /\/api\/companion\/stt/);
assert.match(workerVoice, /function sameSiteRequest\(/);
assert.match(workerVoice, /Cross-site voice request blocked/);

assert.match(tts, /@cf\/myshell-ai\/melotts/);
assert.match(tts, /env\.AI\.run/);
assert.match(tts, /returnRawResponse: true/);
assert.match(tts, /audio\/mpeg/);
assert.match(tts, /AI_BINDING_MISSING/);

assert.match(stt, /@cf\/openai\/whisper-large-v3-turbo/);
assert.match(stt, /MAX_AUDIO_BYTES = 4 \* 1024 \* 1024/);
assert.match(stt, /audio: arrayBufferToBase64\(buffer\)/);
assert.match(stt, /task: "transcribe"/);
assert.match(stt, /language: "zh"/);
assert.match(stt, /vad_filter: true/);
assert.match(stt, /env\.AI\.run/);
assert.match(stt, /NO_SPEECH/);

// Official Mao remains the safe test fallback until a local Li Meng model exists.
assert.equal(config.version, 5);
assert.match(config.defaultModel?.model || "", /^https:\/\/cdn\.jsdelivr\.net\/gh\/Live2D\/CubismWebSamples@/);
assert.match(config.defaultModel?.model || "", /\/Samples\/Resources\/Mao\/Mao\.model3\.json$/);
assert.equal(config.defaultModel?.sample?.name, "Mao");
assert.equal(config.defaultModel?.position?.x, 0.80);
assert.equal(config.defaultModel?.position?.y, 1.08);
assert.equal(config.defaultModel?.position?.height, 0.98);
assert.equal(config.byName?.["李萌"]?.model, "/live2d/characters/limeng/limeng.model3.json");
const fallback = config.byName?.["李萌"]?.fallback;
assert.ok(fallback, "李萌 should keep the official sample fallback until the real model is provided");
assert.match(fallback.model, /^https:\/\/cdn\.jsdelivr\.net\/gh\/Live2D\/CubismWebSamples@/);
assert.equal(fallback.sample?.owner, "Live2D Inc.");

assert.match(readme, /public\/live2d\/characters\/limeng/);
assert.match(readme, /official Live2D `Mao` sample/i);
assert.match(readme, /official hosted Cubism Core/i);
assert.equal(fs.existsSync("public/live2d/vendor/live2dcubismcore.min.js"), false);

console.log("Companion Live2D contract passed: Live2D + presence + neural TTS + real lip sync + microphone Whisper input + safe fallback.");
