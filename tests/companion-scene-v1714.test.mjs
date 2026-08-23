import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/companion-scene-v1714.js', 'utf8');
const css = fs.readFileSync('public/companion-scene-v1714.css', 'utf8');

assert.match(index, /2026-08-23-v17\.16-voice-audio-recovery/);
assert.match(index, /companion-scene-v1714\.css\?v=20260823-v17\.14-safe-scene-restore/);
assert.match(index, /companion-scene-v1714\.js\?v=20260823-v17\.14-safe-scene-restore/);
assert.match(js, /2026-08-23-v17\.14-safe-scene-restore/);
for (const theme of ['galaxy', 'sakura', 'moonlight', 'neon']) assert.ok(js.includes(`"${theme}"`), `missing scene theme ${theme}`);
assert.match(js, /uai_companion_scene_assignments_v1/);
assert.match(js, /uaiCompanionSceneButtonV1714/);
assert.match(js, /uai:companion-scene-changed/);
assert.match(js, /pointermove/);
assert.doesNotMatch(js, /observe\(document\.body/);
assert.doesNotMatch(js, /subtree\s*:\s*true/);
assert.doesNotMatch(js, /companion-v12|companion-v11|companion-v10/);
assert.doesNotMatch(js, /window\.fetch\s*=/);

assert.match(css, /\.uai-c-v1714-scene\s*\{[^}]*position:absolute/s);
assert.match(css, /\.uai-c-v1714-scene\s*\{[^}]*pointer-events:none/s);
assert.match(css, /data-v1714-scene-theme="galaxy"/);
assert.match(css, /data-v1714-scene-theme="sakura"/);
assert.match(css, /data-v1714-scene-theme="moonlight"/);
assert.match(css, /data-v1714-scene-theme="neon"/);
assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template/s);
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template/s);
assert.match(css, /prefers-reduced-motion/);

console.log('V17.14 isolated companion scene contract passed');