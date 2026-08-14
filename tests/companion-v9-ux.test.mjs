import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const shell = fs.readFileSync("public/companion-v9-shell.js", "utf8");
const editor = fs.readFileSync("public/companion-character-editor.js", "utf8");
const settings = fs.readFileSync("public/companion-settings.js", "utf8");
const extras = fs.readFileSync("public/companion-extras.js", "utf8");
const css = fs.readFileSync("public/companion-v9.css", "utf8");

assert.match(boot, /v9\.4-dual-mode/);
assert.match(boot, /companion-v9\.css/);
assert.match(boot, /companion-v9-shell\.js/);
assert.match(boot, /companion-runtime\.js/);
assert.match(boot, /companion-extras\.js/);
assert.match(boot, /companion-characters-core\.js/);
assert.match(boot, /companion-character-editor\.js/);
assert.match(boot, /companion-settings\.js/);
assert.match(boot, /companion-memory\.js/);
assert.match(boot, /companion-records\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-characters-ui\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-v3\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-v4\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-v5\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-create-controls\.js/);
assert.match(boot, /companionV9ShellReady/);
assert.match(boot, /companionSettingsReady/);
assert.match(boot, /companionRuntimeReady/);

assert.match(shell, /v9\.2-shell/);
assert.match(shell, /PROFILE_LIMIT = 5000/);
assert.match(shell, /uai-c-v9-profile-actions/);
assert.match(shell, /openManager/);
assert.match(shell, /openEditor/);
assert.match(shell, /openCreate/);
assert.match(shell, /function ensureChatSearch\(/);
assert.match(shell, /uaiV9ChatSearch/);
assert.match(shell, /showSearch/);
assert.match(shell, /#uaiOnboardQuick/);
assert.match(shell, /创建你的第一个角色/);
assert.match(shell, /开始聊天/);
assert.match(shell, /uai-c-v9-role-manager/);
assert.match(shell, /function cleanMemoryModal\(/);
assert.match(shell, /uaiV9MemoryAdvanced/);
assert.match(shell, /整理、归档与去重/);
assert.match(shell, /function consolidateMessageActions\(/);
assert.match(shell, /label === "记住"/);
assert.match(shell, /button\.textContent = "编辑"/);
assert.doesNotMatch(shell, /COMPANION_ROLE_CARD/);

assert.match(editor, /v9\.3-character-editor/);
assert.match(editor, /PROFILE_LIMIT = 5000/);
assert.doesNotMatch(editor, /ensureRoleToolbar/);
assert.doesNotMatch(editor, /simplifySettingsModal/);
assert.doesNotMatch(editor, /enhanceLongReplies/);

assert.match(settings, /v9\.3-settings/);
assert.match(settings, /uaiV9DataPanel/);
assert.match(settings, /约 500 字/);
assert.match(settings, /约 1000 字/);
assert.match(settings, /约 5000 字/);

assert.match(extras, /v9\.3-extras/);
assert.match(extras, /function ensureLongReplies\(/);
assert.match(extras, /uaiV9RelationshipRecord/);
assert.match(extras, /本月回顾/);

assert.match(css, /grid-template-columns:264px minmax\(0,1fr\)/);
assert.match(css, /grid-template-rows:minmax\(0,1fr\) auto/);
assert.match(css, /\.uai-c-header\{display:none!important\}/);
assert.match(css, /width:min\(100%,1120px\)/);
assert.match(css, /font-size:16\.5px!important/);
assert.match(css, /\.uai-c-v9-message-author/);
assert.match(css, /uai-c-v9-role-manager/);
assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css, /@media \(max-width:900px\)/);
assert.match(css, /@media \(max-width:520px\)/);

console.log("Companion V9.4 focused module and UX contract passed.");
