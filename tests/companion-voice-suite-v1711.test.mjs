import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/companion-voice-suite-v1711.js', 'utf8');
const css = fs.readFileSync('public/companion-voice-suite-v1711.css', 'utf8');

assert.match(js, /2026-08-23-v17\.16-voice-audio-recovery/);
assert.match(js, /\/api\/companion\/tts\/status/);
assert.match(js, /\/api\/companion\/tts/);
assert.match(js, /uai_companion_neural_voice_v1/);
assert.match(js, /provider:\s*"auto"/);
assert.match(js, /fallbackSystem/);
assert.match(js, /SpeechSynthesisUtterance/);
assert.match(js, /AbortController/);
assert.match(js, /attributeFilter:\s*\["disabled"\]/);
assert.match(js, /自动朗读新回复/);
assert.match(js, /MONTHLY REVIEW/);
assert.match(js, /本月会话/);
assert.match(js, /本月消息/);

// Neural playback must be user-unlockable and must not depend on a fresh Audio element
// created only after the asynchronous TTS response arrives.
assert.match(js, /function unlockAudio\(/);
assert.match(js, /pointerdown", unlockAudio/);
assert.match(js, /function ensurePlaybackContext\(/);
assert.match(js, /decodeAudioData/);
assert.match(js, /createBufferSource/);
assert.match(js, /function ensureFallbackAudio\(/);
assert.match(js, /uaiCompanionVoiceAudioV1716/);
assert.match(js, /URL\.revokeObjectURL/);
assert.match(js, /浏览器拦截了声音/);
assert.match(js, /lastPlaybackError/);

assert.doesNotMatch(js, /window\.fetch\s*=/, 'voice suite must not replace window.fetch');
assert.doesNotMatch(js, /observe\(document\.body/, 'voice suite must not observe the whole body');
assert.doesNotMatch(js, /subtree\s*:\s*true/, 'voice suite must not use subtree-wide MutationObserver');
assert.doesNotMatch(js, /UnlimitedCompanionLive2D/, 'voice suite must not depend on Live2D');
assert.doesNotMatch(js, /companion-v1[012]/, 'voice suite must not load legacy structural themes');

assert.doesNotMatch(css, /#uaiCompanionRoot\s*\{[^}]*grid-template-columns/s, 'voice suite must not rewrite companion shell columns');
assert.doesNotMatch(css, /#uaiCompanionRoot\s*\{[^}]*grid-template-rows/s, 'voice suite must not rewrite companion shell rows');
assert.match(css, /prefers-reduced-motion/);

if (index.includes('v17.16-voice-audio-recovery')) {
  assert.match(index, /companion-voice-suite-v1711\.css\?v=20260823-v17\.16-voice-audio-recovery/);
  assert.match(index, /companion-voice-suite-v1711\.js\?v=20260823-v17\.16-voice-audio-recovery/);
}

console.log('V17.16 safe neural voice audio recovery contract passed');