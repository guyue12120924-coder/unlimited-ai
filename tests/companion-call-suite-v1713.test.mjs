import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/companion-call-suite-v1713.js', 'utf8');
const css = fs.readFileSync('public/companion-call-suite-v1713.css', 'utf8');

assert.match(index, /companion-call-suite-v1713\.js\?v=20260823-v17\.14-call-audio-recovery/);
assert.match(js, /2026-08-23-v17\.14-call-audio-recovery/);
assert.match(js, /\/api\/companion\/stt/);
assert.match(js, /\/api\/companion\/tts/);
assert.match(js, /voice_id:\s*settings\.voiceId/);
assert.match(js, /engine:\s*settings\.engine/);
assert.match(js, /navigator\.mediaDevices\.getUserMedia/);
assert.match(js, /MediaRecorder/);
assert.match(js, /AudioContext|webkitAudioContext/);
assert.match(js, /getByteTimeDomainData/);
assert.match(js, /rms > \.034/);
assert.match(js, /send\.click\(\)/, 'auto-send is allowed only inside the explicit call module');
assert.match(js, /callActive/);
assert.match(js, /UnlimitedCompanionStageV1712/);
assert.match(js, /UnlimitedCompanionVoiceV1711/);
assert.match(js, /transcribeController\?\.abort/);
assert.match(js, /ttsController\?\.abort/);
assert.match(js, /generationObserver\?\.disconnect/);
assert.match(js, /attributeFilter:\s*\["disabled"\]/);
assert.match(js, /pagehide/);
assert.match(js, /visibilitychange/);

for (const voice of ['ara', 'eve', 'sal', 'rex', 'leo']) assert.ok(js.includes(voice));

// Audio recovery: unlock during the explicit call gesture, use a persistent audio element
// and prefer an already-resumed WebAudio context for async TTS playback.
assert.match(js, /function unlockPlayback\(/);
assert.match(js, /pointerdown", unlockPlayback/);
assert.match(js, /function ensureFallbackAudio\(/);
assert.match(js, /uaiCompanionCallAudioV1714/);
assert.match(js, /function ensurePlaybackContext\(/);
assert.match(js, /context\.createBufferSource\(\)/);
assert.match(js, /context\.decodeAudioData/);
assert.match(js, /playBlobWithWebAudio/);
assert.match(js, /playBlobWithAudio/);
assert.match(js, /浏览器拦截了声音/);
assert.match(js, /lastPlaybackError/);
assert.match(js, /unlockPlayback\(\);[\s\S]{0,2200}await startListening\(true\)/,
  'call start must unlock playback before waiting for microphone startup');

assert.doesNotMatch(js, /window\.fetch\s*=/, 'call mode must never replace window.fetch');
assert.doesNotMatch(js, /observe\(document\.body/, 'call mode must not observe the whole document body');
assert.doesNotMatch(js, /subtree\s*:\s*true/, 'call mode must not use subtree-wide MutationObserver');
assert.doesNotMatch(js, /companion-v10|companion-v11|companion-v12/, 'call mode must not load legacy structural themes');
assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template-columns/s, 'call mode must not rewrite the core shell');
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template-rows/s, 'call mode must not rewrite the core main rows');
assert.match(css, /position:\s*fixed/);
assert.match(css, /prefers-reduced-motion/);

console.log('V17.14 companion call audio recovery contract passed');