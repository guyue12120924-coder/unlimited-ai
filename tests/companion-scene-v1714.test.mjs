import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/companion-scene-v1714.js', 'utf8');
const css = fs.readFileSync('public/companion-scene-v1714.css', 'utf8');

assert.match(index, /2026-08-23-v17\.20-emotional-voice-system/);
assert.match(index, /companion-scene-v1714\.css\?v=20260823-v17\.18-cinematic-scenes/);
assert.match(index, /companion-scene-v1714\.js\?v=20260823-v17\.14-safe-scene-restore/);
assert.match(js, /2026-08-23-v17\.14-safe-scene-restore/);
for (const theme of ['galaxy', 'sakura', 'moonlight', 'neon']) assert.ok(js.includes(`"${theme}"`));
assert.match(js, /uai_companion_scene_assignments_v1/);
assert.match(js, /uai:companion-scene-changed/);
assert.doesNotMatch(js, /observe\(document\.body/);
assert.doesNotMatch(js, /subtree\s*:\s*true/);
assert.doesNotMatch(js, /window\.fetch\s*=/);
assert.match(css, /V17\.18 cinematic companion scene/);
assert.match(css, /v1718Meteor/);
assert.match(css, /v1718PetalFall/);
assert.match(css, /v1718MoonBeam/);
assert.match(css, /clip-path:polygon/);
assert.match(css, /v1718NeonScan/);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template/s);
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template/s);
console.log('V17.18 cinematic scenes retained under V17.20 frontend');