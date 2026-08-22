import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const runtime = fs.readFileSync('public/companion-runtime-safe-v179.js', 'utf8');
const css = fs.readFileSync('public/companion-runtime-safe-v179.css', 'utf8');

assert.match(index, /companion-runtime-safe-v179\.js\?v=20260822-v17\.9-safe-runtime-restore/);
assert.match(index, /companion-runtime-safe-v179\.css\?v=20260822-v17\.9-safe-runtime-restore/);
assert.match(index, /2026-08-22-v17\.9-safe-runtime-restore/);

assert.match(runtime, /2026-08-22-v17\.9-safe-runtime-restore/);
assert.doesNotMatch(runtime, /window\.fetch\s*=/, 'V17.9 must not wrap window.fetch');
assert.doesNotMatch(runtime, /nativeFetch|patchCompanionBody|installFetchTransform/, 'legacy request rewriting must stay retired');
assert.doesNotMatch(runtime, /observe\(document\.body/, 'V17.9 must not observe the whole document body');
assert.doesNotMatch(runtime, /subtree\s*:\s*true/, 'V17.9 must not use subtree-wide observation');
assert.match(runtime, /attributeFilter:\s*\["disabled"\]/, 'generation observation must be scoped to the input disabled attribute');

for (const marker of [
  '[data-switch-character]',
  '[data-delete-character]',
  '#uaiCompanionAddCharacter',
  '#uaiCompanionReset',
  "[data-v178-data='import']",
  "[data-v178-data='rollback']",
  '当前回复还在生成'
]) assert.ok(runtime.includes(marker), `missing generation guard marker: ${marker}`);

assert.match(runtime, /restoreActiveCharacterSlots/);
assert.match(runtime, /keeping character data intact/);
assert.match(runtime, /pruneOrphanedRoleData/);
assert.match(runtime, /uai-c-v179-status/);
assert.match(runtime, /简短回复/);
assert.match(runtime, /自然回复/);
assert.match(runtime, /详细回复/);
assert.match(runtime, /记忆关闭/);
assert.match(runtime, /记忆开启/);

assert.doesNotMatch(css, /grid-template-columns\s*:/, 'safe runtime CSS must not change companion columns');
assert.doesNotMatch(css, /grid-template-rows\s*:/, 'safe runtime CSS must not change companion rows');
assert.doesNotMatch(css, /#uaiCompanionMessages\s*\{[^}]*display\s*:\s*none/s);
assert.match(css, /prefers-reduced-motion/);

console.log('V17.9 safe companion runtime contract passed');
