import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/companion-luminous-shell-v1719.css', 'utf8');

assert.match(index, /2026-08-23-v17\.19-luminous-full-canvas/);
assert.match(index, /companion-luminous-shell-v1719\.css\?v=20260823-v17\.19-luminous-full-canvas/);
assert.ok(index.indexOf('companion-atmosphere-v1715.css') < index.indexOf('companion-luminous-shell-v1719.css'), 'V17.19 must load after atmosphere so it can brighten the final shell');

assert.match(css, /#uaiCompanionRoot\s*\{[^}]*--v1719-glow-a/s, 'the root needs theme-aware scene glow variables');
assert.match(css, /data-v1714-scene-theme="galaxy"/);
assert.match(css, /data-v1714-scene-theme="sakura"/);
assert.match(css, /data-v1714-scene-theme="moonlight"/);
assert.match(css, /data-v1714-scene-theme="neon"/);
assert.match(css, /\.uai-c-sidebar\s*\{[^}]*linear-gradient[^}]*var\(--v1719-shell-top\)/s, 'sidebar must be scene-tinted glass instead of opaque black');
assert.match(css, /\.uai-c-sidebar::before/, 'sidebar should receive scene ambient light');
assert.match(css, /\.uai-c-v1714-scene\s*\{[^}]*brightness\(1\.12\)[^}]*saturate\(1\.16\)/s, 'main scene should be brighter and more saturated');
assert.match(css, /data-v1715-period="night"[^}]*brightness\(1\.07\)[^}]*saturate\(1\.20\)/s, 'night mode must not crush the cinematic scene back toward black');
assert.match(css, /\.uai-c-v1714-vignette\s*\{[^}]*rgba\(10,8,22,\.42\)/s, 'reading veil must be softened rather than opaque');
assert.match(css, /\.uai-c-header\s*\{[^}]*backdrop-filter:[^}]*brightness\(1\.08\)/s, 'header should be luminous glass');
assert.match(css, /\.uai-c-composer\s*\{[^}]*rgba\(50,39,63,\.76\)/s, 'composer should use luminous glass instead of a black slab');
assert.match(css, /#uaiCompanionStageV1712 canvas\s*\{[^}]*brightness\(1\.035\)/s, 'Live2D should receive a subtle brightness lift');
assert.match(css, /\.uai-c-v1714-scene-button\s*\{[^}]*backdrop-filter: blur\(20px\)/s, 'scene controller should remain premium glass');
assert.match(css, /prefers-reduced-motion/);

assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template/s, 'V17.19 must not alter the stable shell grid');
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template/s, 'V17.19 must not alter stable main rows');
assert.doesNotMatch(css, /display\s*:\s*none[^}]*uai-c-messages|visibility\s*:\s*hidden[^}]*uai-c-messages/i, 'V17.19 must not hide messages');
assert.doesNotMatch(css, /canvas\s*\{[^}]*position\s*:\s*fixed/s, 'V17.19 must not turn Live2D back into a floating stage');

console.log('V17.19 luminous full-canvas companion shell contract passed');
