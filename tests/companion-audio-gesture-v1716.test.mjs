import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/companion-audio-gesture-v1716.js', 'utf8');

assert.match(js, /2026-08-23-v17\.16-audio-gesture-guard/);
assert.match(js, /UnlimitedCompanionVoiceV1711/);
assert.match(js, /UnlimitedCompanionCallV1713/);
assert.match(js, /pointerdown/);
assert.match(js, /voice\.getSettings\?\.\(\)\.enabled/);
assert.match(js, /voice\.unlockAudio\(\)/);
assert.match(js, /lastPlaybackError/);
assert.match(js, /call\.getSettings\?\.\(\)\.speaker/);
assert.match(js, /stopImmediatePropagation\(\)/);
assert.match(js, /call\.retryVoice\?\.\(\)/);
assert.doesNotMatch(js, /MutationObserver/);
assert.doesNotMatch(js, /window\.fetch\s*=/);
assert.doesNotMatch(js, /subtree\s*:/);

if (index.includes('companion-audio-gesture-v1716.js')) {
  assert.match(index, /companion-audio-gesture-v1716\.js\?v=20260823-v17\.16-audio-gesture-guard/);
}

console.log('V17.16 companion audio gesture guard contract passed');