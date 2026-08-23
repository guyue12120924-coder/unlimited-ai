import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/companion-call-suite-v1713.js', 'utf8');
const css = fs.readFileSync('public/companion-call-suite-v1713.css', 'utf8');

assert.match(index, /companion-call-suite-v1713\.js\?v=20260823-v17\.20-emotional-call-unified/);
assert.match(js, /2026-08-23-v17\.20-emotional-call-unified/);
assert.match(js, /\/api\/companion\/stt/);
assert.match(js, /navigator\.mediaDevices\.getUserMedia/);
assert.match(js, /MediaRecorder/);
assert.match(js, /AudioContext|webkitAudioContext/);
assert.match(js, /getByteTimeDomainData/);
assert.match(js, /rms > \.034/);
assert.match(js, /send\.click\(\)/, 'auto-send is allowed only inside explicit call mode');
assert.match(js, /callActive/);
assert.match(js, /UnlimitedCompanionStageV1712/);
assert.match(js, /UnlimitedCompanionVoiceV1711/);
assert.match(js, /voiceApi\(\)\?\.getSettings/);
assert.match(js, /voiceApi\(\)\.setSettings|voiceApi\(\)\?\.setSettings/);
assert.match(js, /uai:companion-voice-profile/);
assert.match(js, /setAutoReadSuppressed/);
assert.match(js, /api\.speak\(cleaned/,'call replies must reuse the shared emotional voice engine');
assert.match(js, /source:\s*"call"/);
assert.match(js, /voiceId:\s*settings\.voiceId/);
assert.match(js, /playbackRate:\s*settings\.playbackRate/);
assert.match(js, /speechMode:\s*settings\.speechMode/);
assert.match(js, /emotionEnabled:\s*settings\.emotionEnabled/);
assert.match(js, /transcribeController\?\.abort/);
assert.match(js, /generationObserver\?\.disconnect/);
assert.match(js, /attributeFilter:\s*\["disabled"\]/);
assert.match(js, /pagehide/);
assert.match(js, /visibilitychange/);
assert.match(js, /function unlockPlayback\(/);
assert.match(js, /pointerdown", unlockPlayback/);
assert.match(js, /unlockPlayback\(\);[\s\S]{0,2200}await startListening\(true\)/,
  'call start must unlock shared playback before waiting for microphone startup');

assert.doesNotMatch(js, /\/api\/companion\/tts/, 'call module must not maintain a second TTS transport');
assert.doesNotMatch(js, /createBufferSource/, 'call module must not duplicate the shared audio renderer');
assert.doesNotMatch(js, /window\.fetch\s*=/, 'call mode must never replace window.fetch');
assert.doesNotMatch(js, /observe\(document\.body/, 'call mode must not observe the whole document body');
assert.doesNotMatch(js, /subtree\s*:\s*true/, 'call mode must not use subtree-wide MutationObserver');
assert.doesNotMatch(js, /companion-v10|companion-v11|companion-v12/, 'call mode must not load legacy structural themes');
assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template-columns/s);
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template-rows/s);
assert.match(css, /position:\s*fixed/);
assert.match(css, /prefers-reduced-motion/);

console.log('V17.20 unified emotional call contract passed');