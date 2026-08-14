import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const shell = fs.readFileSync("public/companion-v10-shell.js", "utf8");
const css = fs.readFileSync("public/companion-v10.css", "utf8");
const editor = fs.readFileSync("public/companion-character-editor.js", "utf8");
const settings = fs.readFileSync("public/companion-settings.js", "utf8");
const extras = fs.readFileSync("public/companion-extras.js", "utf8");

assert.match(boot, /v12\.(?:9|10)-live2d/);
assert.match(boot, /companion-v10\.css/);
assert.match(boot, /companion-v10-shell\.js/);
assert.match(boot, /companionV10ShellReady/);
assert.doesNotMatch(boot, /companion-v9\.css/);
assert.doesNotMatch(boot, /companion-v9-shell\.js/);

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
assert.match(shell, /input\.rows = 2/);
assert.match(shell, /send\.textContent = "↑"/);
assert.match(shell, /PROFILE_LIMIT = 5000/);
assert.match(shell, /创建你的第一个角色/);
assert.match(shell, /uai-c-v10-role-manager/);
assert.match(shell, /uaiV10MemoryAdvanced/);
assert.match(shell, /uai-c-v10-settings/);
assert.doesNotMatch(shell, /COMPANION_ROLE_CARD/);

// Regression: only legacy action nodes that were actually created by the
// underlying modules may act as anchors. V10 keeps those nodes hidden instead
// of deleting them, so the multi-character observer does not recreate
// "重新生成" forever. V10 must not invent a fake .uai-c-v3-actions marker
// before the core has had a chance to create the real action buttons.
assert.match(shell, /function normalizeActionLabel\(/);
assert.match(shell, /function dedupeToolbar\(/);
assert.match(shell, /source\.hidden = true/);
assert.match(shell, /source\.dataset\.v10Consumed = "1"/);
assert.match(shell, /seen\.has\(label\)/);
assert.doesNotMatch(shell, /source\.remove\(\)/);
assert.doesNotMatch(shell, /uai-c-v10-core-action-anchor/);
assert.doesNotMatch(shell, /toolbar\.className = "uai-c-v8-message-actions uai-c-v10-message-toolbar"/);

// V10.2 visual refinement remains a protected lower-layer contract even though
// the product boot shell has advanced to V12.x.
assert.match(css, /Companion V10\.2/);
assert.match(css, /--v10-bg:#2d2f3a/);
assert.match(css, /grid-template-columns:248px minmax\(0,1fr\)/);
assert.match(css, /grid-template-rows:62px minmax\(0,1fr\) auto/);
assert.match(css, /\.uai-c-header\{/);
assert.doesNotMatch(css, /\.uai-c-header\{display:none!important\}/);
assert.match(css, /uai-c-header-left\{width:min\(100%,900px\)/);
assert.match(css, /uai-c-message-row\{[\s\S]*width:min\(100%,900px\)/);
assert.match(css, /uai-c-message-row\.assistant>div\{width:min\(100%,780px\)/);
assert.match(css, /font-size:16\.5px!important/);
assert.match(css, /uai-c-v10-message-avatar/);
assert.match(css, /uai-c-v10-starters>div\{display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(css, /uai-c-composer\{[\s\S]*width:min\(100%,900px\)/);
assert.match(css, /min-height:78px!important/);
assert.match(css, /width:46px!important/);
assert.match(css, /border-radius:50%!important/);
assert.match(css, /backdrop-filter:blur\(18px\)!important/);
assert.match(css, /uai-c-composer-hint\{display:none!important\}/);
assert.match(css, /overflow-x:hidden!important/);
assert.match(css, /uai-c-v10-message-toolbar\{[\s\S]*flex-wrap:wrap!important/);
assert.match(css, /uai-c-v3-actions\[data-v10-consumed\]/);
assert.match(css, /@media \(max-width:900px\)/);
assert.match(css, /@media \(max-width:520px\)/);

assert.match(editor, /PROFILE_LIMIT = 5000/);
assert.match(settings, /约 500 字/);
assert.match(settings, /约 1000 字/);
assert.match(settings, /约 5000 字/);
assert.match(extras, /ensureLongReplies/);
assert.match(extras, /showMonthlyReview/);

console.log("Companion V10.2 visual refinement remains stable under the V12.10 boot shell.");
