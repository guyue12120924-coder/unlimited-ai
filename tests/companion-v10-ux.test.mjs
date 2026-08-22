import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const boot = read("public/boot-diagnostics.js");
const loader = read("public/companion-assets-loader-v174.js");
const shell = read("public/companion-v10-shell.js");
const css = read("public/companion-v10.css");
const editor = read("public/companion-character-editor.js");
const settings = read("public/companion-settings.js");
const extras = read("public/companion-extras.js");

assert.match(boot, /2026-08-22-v17\.4-companion-verified-commit/);
for (const asset of ["companion-v10.css", "companion-v10-shell.js", "companion-live2d-model-pool.js", "companion-v12-ux-hardening.js"]) {
  assert.ok(loader.includes(asset), `V17.4 loader is missing ${asset}`);
}
assert.match(boot, /companionV10ShellReady/);
assert.doesNotMatch(boot, /companion-v9\.css|companion-v9-shell\.js/);

assert.match(shell, /v10\.1-shell/);
assert.match(shell, /uai-c-v10-role-menu/);
assert.match(shell, /编辑角色/);
assert.match(shell, /切换角色/);
assert.match(shell, /新增角色/);
assert.match(shell, /角色管理/);
assert.match(shell, /function ensureChatSearch\(/);
assert.match(shell, /uaiV10ChatSearch/);
assert.match(shell, /function decorateHeader\(/);
assert.match(shell, /uai-c-v10-author/);
assert.match(shell, /uai-c-v10-message-avatar/);
assert.match(shell, /function ensureConversationStarters\(/);
assert.match(shell, /今天过得怎么样/);
assert.match(shell, /有点想你/);
assert.match(shell, /陪我聊会儿/);
assert.match(shell, /PROFILE_LIMIT = 5000/);
assert.match(shell, /创建你的第一个角色/);
assert.match(shell, /function normalizeActionLabel\(/);
assert.match(shell, /function dedupeToolbar\(/);
assert.match(shell, /source\.hidden = true/);
assert.match(shell, /source\.dataset\.v10Consumed = "1"/);
assert.doesNotMatch(shell, /source\.remove\(\)/);

assert.match(css, /Companion V10\.2/);
assert.match(css, /--v10-bg:#2d2f3a/);
assert.match(css, /grid-template-columns:248px minmax\(0,1fr\)/);
assert.match(css, /grid-template-rows:62px minmax\(0,1fr\) auto/);
assert.match(css, /\.uai-c-header\{/);
assert.doesNotMatch(css, /\.uai-c-header\{display:none!important\}/);
assert.match(css, /uai-c-message-row/);
assert.match(css, /uai-c-composer/);
assert.match(css, /@media \(max-width:900px\)/);
assert.match(css, /@media \(max-width:520px\)/);

assert.match(editor, /PROFILE_LIMIT = 5000/);
assert.match(settings, /约 500 字/);
assert.match(settings, /约 1000 字/);
assert.match(settings, /约 5000 字/);
assert.match(extras, /ensureLongReplies/);
assert.match(extras, /showMonthlyReview/);

console.log("Companion V10 UX contract remains stable under the V17.4 verified enhancement loader.");
