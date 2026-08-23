import fs from 'node:fs';
import assert from 'node:assert/strict';

const js = fs.readFileSync('public/companion-character-stage-v1712.js', 'utf8');
const css = fs.readFileSync('public/companion-character-stage-v1712.css', 'utf8');

assert.match(js, /2026-08-23-v17\.12-isolated-character-stage/);
assert.match(js, /\/live2d\/characters\.json/);
assert.match(js, /pixi\.js@6\.5\.10/);
assert.match(js, /pixi-live2d-display@0\.4\.0/);
assert.match(js, /live2dcubismcore\.min\.js/);
assert.match(js, /Live2DModel\.from/);
assert.match(js, /setEmotion/);
assert.match(js, /setMouthOpen/);
assert.match(js, /destroyStage/);
assert.match(js, /app\.destroy/);
assert.match(js, /resizeObserver\?\.disconnect/);
assert.match(js, /voiceObserver\?\.disconnect/);
assert.match(js, /generationObserver\?\.disconnect/);
assert.match(js, /attributeFilter:\s*\["data-v1711-voice-state"\]/);
assert.match(js, /attributeFilter:\s*\["disabled"\]/);
assert.match(js, /角色舞台/);
assert.match(js, /fallbackAvatar/);

assert.doesNotMatch(js, /observe\(document\.body/, 'V17.12 must not observe the whole body');
assert.doesNotMatch(js, /subtree\s*:\s*true/, 'V17.12 must not use subtree-wide MutationObserver');
assert.doesNotMatch(js, /window\.fetch\s*=/, 'V17.12 must not replace window.fetch');
assert.doesNotMatch(js, /companion-v10|companion-v11|companion-v12/, 'V17.12 must not load legacy structural themes');
assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template-columns/s, 'V17.12 must not change core shell columns');
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template-rows/s, 'V17.12 must not change core main rows');
assert.match(css, /position:\s*fixed/);
assert.match(css, /prefers-reduced-motion/);

console.log('V17.12 isolated character stage contract passed');
