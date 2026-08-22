import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("public/index.html");
const boot = read("public/boot-diagnostics.js");
const loader = read("public/companion-assets-loader-v174.js");
const phase4 = read("public/companion-v12-phase4-themes.js");
const runtime = read("public/companion-live2d.js");
const interaction = read("public/companion-live2d-interaction.js");
const voice = read("public/companion-live2d-voice.js");
const neuralVoice = read("public/companion-live2d-neural-voice.js");
const voiceInput = read("public/companion-voice-input.js");
const callMode = read("public/companion-call-mode.js");
const modelPool = read("public/companion-live2d-model-pool.js");
const polish = read("public/companion-live2d-polish.js");
const emotion = read("public/companion-live2d-emotion-engine.js");
const uxHardening = read("public/companion-v12-ux-hardening.js");
const poolConfig = JSON.parse(read("public/live2d/model-pool.json"));
const wrangler = read("wrangler.toml");
const workerVoice = read("src/worker-voice.js");
const tts = read("src/tts.js");
const stt = read("src/stt.js");

assert.match(index, /boot-diagnostics\.js\?v=20260822-v17\.4-companion-verified-commit/);
assert.match(boot, /companion-entry-v174\.js/);
for (const asset of [
  "companion-live2d.css", "companion-live2d.js",
  "companion-live2d-interaction.css", "companion-live2d-interaction.js",
  "companion-live2d-voice.css", "companion-live2d-voice.js",
  "companion-live2d-neural-voice.css", "companion-live2d-neural-voice.js",
  "companion-voice-input.css", "companion-voice-input.js",
  "companion-call-mode.css", "companion-call-mode.js",
  "companion-live2d-model-pool.css", "companion-live2d-model-pool.js",
  "companion-live2d-polish.css", "companion-live2d-polish.js",
  "companion-live2d-emotion-engine.css", "companion-live2d-emotion-engine.js",
  "companion-v12-ux-hardening.css", "companion-v12-ux-hardening.js"
]) assert.ok(loader.includes(asset), `V17.4 loader is missing ${asset}`);
assert.match(loader, /link\.media = "not all"/);
assert.match(loader, /await waitForVerifiedDom\(\)/);
assert.match(loader, /function activateStyles\(/);
assert.doesNotMatch(phase4, /ensureStyle\(|ensureScript\(|loadPhase5SceneState\(/,
  "phase4 must not bypass the verified loader");

assert.match(runtime, /v12\.18-live2d-lipsync/);
assert.match(runtime, /pixi-live2d-display@0\.4\.0/);
assert.match(runtime, /function resolveLipSyncIds\(/);
assert.match(runtime, /ParamMouthOpenY/);
assert.match(runtime, /PARAM_MOUTH_OPEN_Y/);
assert.match(runtime, /function applyMouthFrame\(/);
assert.match(runtime, /window\.UnlimitedCompanionLive2D/);

assert.match(interaction, /function classifyEmotion\(/);
for (const name of ["happy", "shy", "caring", "sad", "angry", "thinking"]) {
  assert.ok(interaction.includes(name), `presence bridge missing ${name}`);
}
assert.match(interaction, /setEmotion/);

assert.match(voice, /SpeechSynthesisUtterance/);
assert.match(neuralVoice, /\/api\/companion\/tts/);
assert.match(neuralVoice, /new Audio\(url\)/);
assert.match(voiceInput, /MediaRecorder/);
assert.match(voiceInput, /\/api\/companion\/stt/);
assert.match(callMode, /autoSend: true/);
assert.match(callMode, /autoListen: true/);
for (const voiceId of ["ara", "eve", "sal", "rex", "leo"]) assert.ok(callMode.includes(voiceId), `missing Grok voice ${voiceId}`);

assert.match(modelPool, /v12\.22-curated-live2d-pool-1/);
assert.match(modelPool, /\/live2d\/model-pool\.json/);
assert.match(modelPool, /function chooseLeastUsed\(/);
assert.match(modelPool, /function setManualModel\(/);
assert.match(modelPool, /window\.UnlimitedCompanionLive2DModelPool/);
assert.equal(poolConfig.version, 2);
assert.equal(poolConfig.models.length, 8);
assert.deepEqual(poolConfig.models.map((item) => item.id), ["mao", "shizuku", "hiyori", "rice", "miara", "epsilon", "hibiki", "tsumiki"]);
assert.equal(poolConfig.models.filter((item) => item.autoEligible !== false).length, 6);

assert.match(polish, /v12\.19-live2d-polish/);
assert.match(polish, /function diagnostics\(/);
assert.match(emotion, /v12\.20-live2d-emotion-engine-2/);
assert.match(emotion, /function buildAutoMapping\(/);
assert.match(emotion, /applyMappedEmotion/);
assert.match(uxHardening, /v12\.23-ux-hardening-2/);
assert.match(uxHardening, /function setImmersive\(/);
assert.match(uxHardening, /UnlimitedCompanionNeuralVoice/);

assert.match(wrangler, /main = "src\/worker-voice\.js"/);
assert.match(workerVoice, /\/api\/companion\/tts/);
assert.match(workerVoice, /\/api\/companion\/stt/);
assert.match(tts, /@cf\/myshell-ai\/melotts/);
assert.match(stt, /@cf\/openai\/whisper-large-v3-turbo/);

console.log("Companion Live2D contract passed under the V17.4 verified enhancement loader.");
