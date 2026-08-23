import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/companion-voice-suite-v1711.js', 'utf8');
const css = fs.readFileSync('public/companion-voice-suite-v1711.css', 'utf8');

assert.match(js, /2026-08-23-v17\.11-safe-neural-voice/);
assert.match(js, /\/api\/companion\/tts\/status/);
assert.match(js, /\/api\/companion\/tts/);
assert.match(js, /uai_companion_neural_voice_v1/);
assert.match(js, /provider:\s*"auto"/);
assert.match(js, /fallbackSystem/);
assert.match(js, /SpeechSynthesisUtterance/);
assert.match(js, /AbortController/);
assert.match(js, /URL\.revokeObjectURL/);
assert.match(js, /activeAudio\.pause/);
assert.match(js, /attributeFilter:\s*\["disabled"\]/);
assert.match(js, /自动朗读新回复/);
assert.match(js, /MONTHLY REVIEW/);
assert.match(js, /本月会话/);
assert.match(js, /本月消息/);

assert.doesNotMatch(js, /window\.fetch\s*=/, 'V17.11 must not replace window.fetch');
assert.doesNotMatch(js, /observe\(document\.body/, 'V17.11 must not observe the whole body');
assert.doesNotMatch(js, /subtree\s*:\s*true/, 'V17.11 must not use subtree-wide MutationObserver');
assert.doesNotMatch(js, /UnlimitedCompanionLive2D/, 'V17.11 must not depend on Live2D');
assert.doesNotMatch(js, /companion-v1[012]/, 'V17.11 must not load legacy structural themes');

assert.doesNotMatch(css, /#uaiCompanionRoot\s*\{[^}]*grid-template-columns/s, 'V17.11 must not rewrite companion shell columns');
assert.doesNotMatch(css, /#uaiCompanionRoot\s*\{[^}]*grid-template-rows/s, 'V17.11 must not rewrite companion shell rows');
assert.match(css, /prefers-reduced-motion/);

// The integration assertions become active as soon as index is advanced to V17.11.
if (index.includes('v17.11-safe-neural-voice')) {
  assert.match(index, /companion-voice-suite-v1711\.css\?v=20260823-v17\.11-safe-neural-voice/);
  assert.match(index, /companion-voice-suite-v1711\.js\?v=20260823-v17\.11-safe-neural-voice/);
}

console.log('V17.11 safe neural voice contract passed');
