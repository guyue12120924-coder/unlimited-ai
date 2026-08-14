import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const shell = fs.readFileSync("public/companion-v9-shell.js", "utf8");
const css = fs.readFileSync("public/companion-v9.css", "utf8");

assert.match(boot, /v9\.3-dual-mode/);
assert.match(boot, /companion-v9\.css/);
assert.match(boot, /companion-v9-shell\.js/);
assert.match(boot, /companion-runtime\.js/);
assert.match(boot, /companion-extras\.js/);
assert.match(boot, /companion-characters-core\.js/);
assert.match(boot, /companion-characters-ui\.js/);
assert.match(boot, /companion-memory\.js/);
assert.match(boot, /companion-records\.js/);
assert.match(boot, /companionV9ShellReady/);
assert.match(boot, /companionRuntimeReady/);

assert.match(shell, /v9\.3-shell/);
assert.match(shell, /PROFILE_LIMIT = 5000/);
assert.match(shell, /uai-c-v9-profile-actions/);
assert.match(shell, /openManager/);
assert.match(shell, /openEditor/);
assert.match(shell, /openCreate/);
assert.match(shell, /function ensureSidebarSearch\(/);
assert.match(shell, /uaiV9SearchChat/);
assert.match(shell, /showSearch/);
assert.match(shell, /Ctrl K/);
assert.doesNotMatch(shell, /uaiCompanionRoleToolbar"\)\?\.remove/);
assert.match(shell, /#uaiOnboardQuick/);
assert.match(shell, /创建你的第一个角色/);
assert.match(shell, /开始聊天/);
assert.match(shell, /uai-c-v9-role-manager/);
assert.match(shell, /function cleanMemoryModal\(/);
assert.match(shell, /uaiV9MemoryAdvanced/);
assert.match(shell, /整理、归档与去重/);
assert.match(shell, /function cleanSettingsModal\(/);
assert.match(shell, /function consolidateMessageActions\(/);
assert.match(shell, /label === "记住"/);
assert.match(shell, /button\.textContent = "编辑"/);
assert.doesNotMatch(shell, /COMPANION_ROLE_CARD/);

assert.match(css, /grid-template-columns:252px minmax\(0,1fr\)/);
assert.match(css, /grid-template-rows:minmax\(0,1fr\) auto/);
assert.match(css, /\.uai-c-header\{display:none!important\}/);
assert.match(css, /width:min\(100%,1040px\)/);
assert.match(css, /font-size:16px!important/);
assert.match(css, /\.uai-c-v9-message-author/);
assert.match(css, /uai-c-v9-role-manager/);
assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css, /@media \(max-width:1200px\)/);
assert.match(css, /@media \(max-width:860px\)/);
assert.match(css, /@media \(max-width:460px\)/);

console.log("Companion V9.3 UX/runtime contract passed.");
