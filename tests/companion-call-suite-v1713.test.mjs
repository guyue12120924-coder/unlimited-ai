import fs from 'node:fs';
import assert from 'node:assert/strict';

const js = fs.readFileSync('public/companion-call-suite-v1713.js', 'utf8');
const css = fs.readFileSync('public/companion-call-suite-v1713.css', 'utf8');

assert.match(js, /2026-08-23-v17\.13-complete-call-experience/);
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
assert.match(js, /URL\.revokeObjectURL/);
assert.match(js, /transcribeController\?\.abort/);
assert.match(js, /ttsController\?\.abort/);
assert.match(js, /generationObserver\?\.disconnect/);
assert.match(js, /attributeFilter:\s*\["disabled"\]/);
assert.match(js, /pagehide/);
assert.match(js, /visibilitychange/);
assert.match(js, /ara/);
assert.match(js, /eve/);
assert.match(js, /sal/);
assert.match(js, /rex/);
assert.match(js, /leo/);

assert.doesNotMatch(js, /window\.fetch\s*=/, 'V17.13 must never replace window.fetch');
assert.doesNotMatch(js, /observe\(document\.body/, 'V17.13 must not observe the whole document body');
assert.doesNotMatch(js, /subtree\s*:\s*true/, 'V17.13 must not use subtree-wide MutationObserver');
assert.doesNotMatch(js, /companion-v10|companion-v11|companion-v12/, 'V17.13 must not load legacy structural themes');
assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template-columns/s, 'call mode must not rewrite the core shell');
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template-rows/s, 'call mode must not rewrite the core main rows');
assert.match(css, /position:\s*fixed/);
assert.match(css, /prefers-reduced-motion/);

console.log('V17.13 isolated call contract passed');
