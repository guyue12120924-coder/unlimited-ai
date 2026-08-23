import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/companion-character-stage-v1712.js', 'utf8');
const css = fs.readFileSync('public/companion-character-stage-v1712.css', 'utf8');

assert.match(index, /2026-08-23-v17\.20-emotional-voice-system/);
assert.match(index, /companion-character-stage-v1712\.css\?v=20260823-v17\.17-integrated-live2d-background/);
assert.match(index, /companion-character-stage-v1712\.js\?v=20260823-v17\.20-emotional-lipsync-compat/);
assert.match(js, /2026-08-23-v17\.20-emotional-lipsync-compat/);
assert.match(js, /\/live2d\/characters\.json/);
assert.match(js, /Live2DModel\.from/);
assert.match(js, /setEmotion/);
assert.match(js, /setMouthOpen/);
assert.match(js, /targetMain\.appendChild\(stageHost\)/);
assert.match(js, /model && currentModelKey === nextKey && rendererHealthy\(\)/);
assert.match(js, /webglcontextlost/);
assert.match(js, /webglcontextrestored/);
assert.match(js, /integrated:\s*true/);
assert.match(js, /function emotionalVoiceOwnsLipSync\(/);
assert.match(js, /v17\.20-emotional-voice-system/);
assert.match(js, /pauseLegacyMouthAnimation/);
assert.match(js, /if \(emotionalVoiceOwnsLipSync\(\)\) pauseLegacyMouthAnimation\(\)/,
  'V17.20 emotional voice must own per-segment mouth animation');
assert.doesNotMatch(js, /data-v1712-reload/);
assert.doesNotMatch(js, /CHARACTER STAGE/);
assert.doesNotMatch(js, /observe\(document\.body/);
assert.doesNotMatch(js, /subtree\s*:\s*true/);
assert.doesNotMatch(js, /window\.fetch\s*=/);
assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template-columns/s);
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template-rows/s);
assert.match(css, /#uaiCompanionStageV1712\s*\{[^}]*position:\s*absolute/s);
assert.doesNotMatch(css, /#uaiCompanionStageV1712\s*\{[^}]*position:\s*fixed/s);
assert.match(css, /prefers-reduced-motion/);
console.log('V17.20 integrated Live2D emotional lip-sync compatibility contract passed');