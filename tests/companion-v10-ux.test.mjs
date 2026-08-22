import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const boot = read("public/boot-diagnostics.js");
const entry = read("public/companion-entry-v175.js");
const shell = read("public/companion-v10-shell.js");
const css = read("public/companion-v10.css");

assert.match(boot, /2026-08-22-v17\.5-companion-core-only-rollback/);
assert.doesNotMatch(boot, /companion-v10\.css|companion-v10-shell\.js|companion-live2d-model-pool\.js|companion-v12-ux-hardening\.js/);
assert.doesNotMatch(entry, /companion-v10\.css|companion-v10-shell\.js|companion-live2d-model-pool\.js|companion-v12-ux-hardening\.js/);

assert.match(shell, /v10\.1-shell/);
assert.match(shell, /uai-c-v10-role-menu/);
assert.match(shell, /function ensureChatSearch\(/);
assert.match(shell, /function decorateHeader\(/);
assert.match(shell, /function ensureConversationStarters\(/);
assert.match(shell, /function normalizeActionLabel\(/);
assert.match(shell, /function dedupeToolbar\(/);
assert.match(css, /Companion V10\.2/);
assert.match(css, /grid-template-columns:248px minmax\(0,1fr\)/);
assert.match(css, /grid-template-rows:62px minmax\(0,1fr\) auto/);
assert.match(css, /@media \(max-width:900px\)/);
assert.match(css, /@media \(max-width:520px\)/);

console.log("Companion V10 source remains available for future rebuild work but is intentionally dormant under the V17.5 core-only rollback.");