import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/companion-luminous-shell-v1719.css', 'utf8');

assert.match(index, /2026-08-23-v17\.20-emotional-voice-system/);
assert.match(index, /companion-luminous-shell-v1719\.css\?v=20260823-v17\.19-luminous-full-canvas/);
assert.ok(index.indexOf('companion-atmosphere-v1715.css') < index.indexOf('companion-luminous-shell-v1719.css'));
assert.match(css, /#uaiCompanionRoot\s*\{[^}]*--v1719-glow-a/s);
assert.match(css, /data-v1714-scene-theme="galaxy"/);
assert.match(css, /data-v1714-scene-theme="sakura"/);
assert.match(css, /data-v1714-scene-theme="moonlight"/);
assert.match(css, /data-v1714-scene-theme="neon"/);
assert.match(css, /\.uai-c-sidebar\s*\{[^}]*linear-gradient[^}]*var\(--v1719-shell-top\)/s);
assert.match(css, /\.uai-c-v1714-scene\s*\{[^}]*brightness\(1\.12\)[^}]*saturate\(1\.16\)/s);
assert.match(css, /data-v1715-period="night"[^}]*brightness\(1\.07\)[^}]*saturate\(1\.20\)/s);
assert.match(css, /\.uai-c-header\s*\{[^}]*backdrop-filter:[^}]*brightness\(1\.08\)/s);
assert.match(css, /#uaiCompanionStageV1712 canvas\s*\{[^}]*brightness\(1\.035\)/s);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template/s);
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template/s);
assert.doesNotMatch(css, /canvas\s*\{[^}]*position\s*:\s*fixed/s);
console.log('V17.19 luminous shell retained under V17.20 frontend');