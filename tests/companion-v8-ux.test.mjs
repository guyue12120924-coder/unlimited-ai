import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const core = fs.readFileSync("public/companion-mode.js", "utf8");
const controls = fs.readFileSync("public/companion-create-controls.js", "utf8");
const lengths = fs.readFileSync("public/companion-reply-length.js", "utf8");
const multi = fs.readFileSync("public/companion-v3.js", "utf8");
const guard = fs.readFileSync("public/companion-v3-guard.js", "utf8");
const memoryTools = fs.readFileSync("public/companion-v4.js", "utf8");
const restoreCore = fs.readFileSync("public/companion-v5.js", "utf8");
const secondary = fs.readFileSync("public/companion-v8-secondary.js", "utf8");
const css = fs.readFileSync("public/companion-profile-editor.css", "utf8");

assert.match(boot, /v8\.4-dual-mode/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-v2\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-v6\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-profile-editor\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-v5-guard\.js/);
assert.match(boot, /companion-v8-secondary\.js/);

for (const retired of [
  "public/companion-v2.js",
  "public/companion-v2.css",
  "public/companion-v6.js",
  "public/companion-v6.css",
  "public/companion-profile-editor.js",
  "public/companion-v5-guard.js"
]) {
  assert.equal(fs.existsSync(retired), false, `${retired} should stay retired`);
}

assert.match(core, /v8\.3-companion-core/);
assert.doesNotMatch(core, /id="uaiCompanionCharacterBtn"/);
assert.doesNotMatch(core, /id="uaiCompanionHeaderMemory"/);
assert.doesNotMatch(core, /id="uaiCompanionHeaderSettings"/);
assert.doesNotMatch(core, /id="uaiCompanionEditProfileInline"/);
assert.match(core, /let autoFollowStreaming = true/);
assert.match(core, /let pendingMessageScrollTop = null/);
assert.match(core, /function bindStreamingScrollIntent\(/);
assert.match(core, /if \(event\.deltaY < 0\) autoFollowStreaming = false/);
assert.match(core, /if \(container && autoFollowStreaming\) container\.scrollTop = container\.scrollHeight/);
assert.match(core, /if \(container && !autoFollowStreaming\) pendingMessageScrollTop = container\.scrollTop/);
assert.match(core, /const targetScrollTop = pendingMessageScrollTop/);

assert.match(controls, /v8\.2-primary-ux/);
assert.match(controls, /PROFILE_LIMIT = 5000/);
assert.match(controls, /MAX_CHARACTERS = 6/);
assert.match(controls, /function openCreate\(/);
assert.match(controls, /function openEditor\(/);
assert.match(controls, /uaiCompanionRoleAdd/);
assert.match(controls, /完整角色设定/);
assert.match(controls, /约 500 字/);
assert.match(controls, /约 1000 字/);
assert.match(controls, /约 5000 字/);
assert.match(controls, /uai-c-v8-note/);
assert.match(controls, /LEGACY_SHELL_CONTROLS/);
assert.match(controls, /#uaiCompanionCharacterBtn/);
assert.match(controls, /#uaiCompanionHeaderMemory/);
assert.match(controls, /#uaiCompanionHeaderSettings/);
assert.match(controls, /#uaiCompanionEditProfileInline/);
assert.match(controls, /function removeLegacyShellControls\(/);
assert.match(controls, /querySelector\(selector\)\?\.remove\(\)/);
assert.doesNotMatch(controls, /UnlimitedCompanionPolish/);
assert.doesNotMatch(controls, /data-v7-edit-character/);

assert.match(lengths, /chars: 500/);
assert.match(lengths, /chars: 1000/);
assert.match(lengths, /chars: 5000/);

assert.doesNotMatch(multi, /function ensureCharacterBar/);
assert.doesNotMatch(multi, /function showCreateCharacter/);
assert.match(multi, /v8\.1-multichar-core/);

assert.doesNotMatch(guard, /new MutationObserver/);
assert.match(guard, /#uaiCompanionRoleAdd/);
assert.match(guard, /#uaiCompanionRoleEdit/);
assert.match(guard, /data-v8-edit-character/);

assert.doesNotMatch(memoryTools, /new MutationObserver/);
assert.match(memoryTools, /clean\(message\?\.content, 12000\)/);
assert.match(memoryTools, /v8\.1-memory-tools/);

assert.doesNotMatch(restoreCore, /new MutationObserver/);
assert.doesNotMatch(restoreCore, /function showTemplates/);
assert.match(restoreCore, /v8\.2-profile-restore-core/);
assert.match(restoreCore, /PROFILE_LIMIT = 5000/);
assert.match(restoreCore, /customDescription: clean\(raw\.customDescription \|\| raw\.description, PROFILE_LIMIT\)/);
assert.match(restoreCore, /function normalizeSettings\(/);
assert.match(restoreCore, /function pruneExpiredRollback\(/);
assert.match(restoreCore, /settings: normalizeSettings\(raw\.settings\)/);

assert.match(secondary, /ensureMessageActions/);
assert.match(secondary, /ensureScrollBottom/);
assert.match(secondary, /showMonthlyReview/);
assert.match(secondary, /dataset\.v8EditCharacter/);
assert.match(secondary, /moment\.textContent = "珍藏"/);

assert.match(css, /uai-c-v8-note/);
assert.match(css, /uai-c-v8-message-actions/);
assert.match(css, /uai-c-v8-review-modal/);
assert.match(css, /uai-c-long-reply/);
assert.doesNotMatch(css, /#uaiCompanionCharacterBtn\{display:none/);
assert.doesNotMatch(css, /uai-c-v2-stage/);
assert.doesNotMatch(css, /uaiCompanionV6QuickSwitch/);

assert.doesNotMatch(controls, /COMPANION_ROLE_CARD/);
assert.doesNotMatch(lengths, /COMPANION_ROLE_CARD/);

console.log("Companion V8.4 runtime and long-reply UX contract passed.");
