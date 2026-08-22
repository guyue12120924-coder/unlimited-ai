import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const boot = read("public/boot-diagnostics.js");
const entry = read("public/companion-entry-v175.js");
const runtime = read("public/companion-live2d.js");
const interaction = read("public/companion-live2d-interaction.js");
const voice = read("public/companion-live2d-voice.js");
const neuralVoice = read("public/companion-live2d-neural-voice.js");
const voiceInput = read("public/companion-voice-input.js");
const callMode = read("public/companion-call-mode.js");
const modelPool = read("public/companion-live2d-model-pool.js");
const polish = read("public/companion-live2d-polish.js");
const emotion = read("public/companion-live2d-emotion-engine.js");
const poolConfig = JSON.parse(read("public/live2d/model-pool.json"));
const workerVoice = read("src/worker-voice.js");
const tts = read("src/tts.js");
const stt = read("src/stt.js");

assert.match(boot, /2026-08-22-v17\.5-companion-core-only-rollback/);
for (const asset of [
  "companion-live2d.js", "companion-live2d-interaction.js", "companion-live2d-voice.js",
  "companion-live2d-neural-voice.js", "companion-voice-input.js", "companion-call-mode.js",
  "companion-live2d-model-pool.js", "companion-live2d-polish.js", "companion-live2d-emotion-engine.js"
]) {
  const pattern = new RegExp(asset.replaceAll(".", "\\."));
  assert.doesNotMatch(boot, pattern, `${asset} must stay out of the active V17.5 boot chain`);
  assert.doesNotMatch(entry, pattern, `${asset} must stay out of the active V17.5 entry`);
}

assert.match(runtime, /v12\.18-live2d-lipsync/);
assert.match(runtime, /pixi-live2d-display@0\.4\.0/);
assert.match(runtime, /function resolveLipSyncIds\(/);
assert.match(runtime, /function applyMouthFrame\(/);
assert.match(runtime, /window\.UnlimitedCompanionLive2D/);
assert.match(interaction, /function classifyEmotion\(/);
assert.match(voice, /SpeechSynthesisUtterance/);
assert.match(neuralVoice, /\/api\/companion\/tts/);
assert.match(voiceInput, /MediaRecorder/);
assert.match(voiceInput, /\/api\/companion\/stt/);
assert.match(callMode, /autoSend: true/);
assert.match(callMode, /autoListen: true/);
assert.match(modelPool, /v12\.22-curated-live2d-pool-1/);
assert.match(polish, /v12\.19-live2d-polish/);
assert.match(emotion, /v12\.20-live2d-emotion-engine-2/);

assert.equal(poolConfig.version, 2);
assert.equal(poolConfig.models.length, 8);
assert.deepEqual(poolConfig.models.map((item) => item.id), ["mao", "shizuku", "hiyori", "rice", "miara", "epsilon", "hibiki", "tsumiki"]);

assert.match(workerVoice, /\/api\/companion\/tts/);
assert.match(workerVoice, /\/api\/companion\/stt/);
assert.match(tts, /@cf\/myshell-ai\/melotts|xai\/grok-tts/);
assert.match(stt, /whisper-large-v3-turbo/);

console.log("Companion Live2D/voice sources remain intact but are intentionally dormant under the V17.5 core-only rollback.");