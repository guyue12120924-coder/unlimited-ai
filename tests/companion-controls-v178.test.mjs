import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const index = read('public/index.html');
const controls = read('public/companion-controls-v178.js');
const controlsCss = read('public/companion-controls-v178.css');
const pack = read('public/companion-function-pack-v177.js');
const core = read('public/companion-mode.js');
const server = read('src/companion.js');

assert.match(index, /2026-08-22-v17\.8-safe-controls-restore/, 'frontend revision must expose V17.8');
assert.match(index, /companion-controls-v178\.css\?v=20260822-v17\.8-safe-controls-restore/, 'V17.8 controls CSS must load');
assert.match(index, /companion-controls-v178\.js\?v=20260822-v17\.8-safe-controls-restore/, 'V17.8 controls JS must load');
assert.match(index, /companion-function-pack-v177\.js\?v=20260822-v17\.7-safe-function-restore[\s\S]*companion-controls-v178\.js/, 'V17.8 controls must load after V17.7 function pack');

assert.doesNotMatch(controls, /window\.fetch\s*=/, 'V17.8 must never wrap window.fetch');
assert.doesNotMatch(controls, /new\s+MutationObserver/, 'V17.8 must not introduce a broad DOM observer');
assert.doesNotMatch(controls, /companion-(?:v10|v11|v12|live2d|assets-loader)/i, 'V17.8 must not reactivate structural enhancement stacks');
assert.match(controls, /uai:companion-functions-ready/, 'V17.8 must wait for the safe function pack readiness signal');
assert.match(controls, /UnlimitedCompanionCharacterControls/, 'V17.8 must restore companion manager access');
assert.match(controls, /UnlimitedCompanionMemorySearch/, 'V17.8 must restore search, moments and memory organizer access');
assert.match(controls, /UnlimitedCompanionProfileRestore/, 'V17.8 must restore relationship and validated import/rollback access');
assert.match(controls, /unlimited-ai-companion-multichar-backup/, 'V17.8 full export must use the validated multi-character backup format');
assert.match(controls, /uaiCompanionReplyLength/, 'V17.8 must enhance the existing core reply-length control instead of replacing storage semantics');

assert.match(pack, /CustomEvent\("uai:companion-functions-ready"/, 'V17.7 must explicitly announce when safe APIs are ready');
assert.match(core, /replyLength:\s*settings\.replyLength/, 'core companion payload must directly send the saved reply length');
assert.match(server, /const REPLY_LENGTH_RULES\s*=/, 'server companion prompt builder must define reply-length behavior');
assert.match(server, /companion_preferences\?\.replyLength/, 'server must consume companion_preferences.replyLength');

assert.doesNotMatch(controlsCss, /\.uai-c-shell\s*\{[^}]*grid-template/si, 'V17.8 CSS must not alter the stable companion shell grid');
assert.doesNotMatch(controlsCss, /\.uai-c-main\s*\{[^}]*grid-template/si, 'V17.8 CSS must not alter the stable companion main rows');
assert.match(controlsCss, /prefers-reduced-motion/, 'V17.8 controls must respect reduced motion');

console.log('V17.8 safe companion controls contract passed');
