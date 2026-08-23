import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/companion-atmosphere-v1715.js', 'utf8');
const css = fs.readFileSync('public/companion-atmosphere-v1715.css', 'utf8');

assert.match(index, /companion-atmosphere-v1715\.css\?v=20260823-v17\.18-cinematic-mood/);
assert.match(index, /companion-atmosphere-v1715\.js\?v=20260823-v17\.15-adaptive-atmosphere/);
assert.match(js, /2026-08-23-v17\.15-adaptive-atmosphere/);
assert.match(js, /attributeFilter:\s*\["disabled"\]/);
assert.match(js, /classifyEmotion/);
assert.match(js, /currentPeriod/);
assert.match(js, /UnlimitedCompanionStageV1712\?\.setEmotion/);
assert.match(js, /uai:companion-atmosphere/);
assert.doesNotMatch(js, /observe\(document\.body/);
assert.doesNotMatch(js, /subtree\s*:\s*true/);
assert.doesNotMatch(js, /window\.fetch\s*=/);

for (const emotion of ['happy', 'shy', 'caring', 'sad', 'angry', 'thinking']) assert.ok(css.includes(`data-v1715-emotion="${emotion}"`));
for (const period of ['morning', 'day', 'evening', 'night']) assert.ok(css.includes(`data-v1715-period="${period}"`));
assert.match(css, /data-v1714-scene-theme="galaxy"[^]*#uaiCompanionCallV1713/);
assert.match(css, /night[^}]*brightness\(\.97\)[^}]*saturate\(1\.22\)/,'night grading should stay vivid instead of crushing the scene to black');
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template/s);
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template/s);

console.log('V17.18 cinematic companion atmosphere contract passed');
