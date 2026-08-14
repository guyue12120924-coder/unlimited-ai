import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const core = fs.readFileSync("public/companion-mode.js", "utf8");
const controls = fs.readFileSync("public/companion-create-controls.js", "utf8");
const runtime = fs.readFileSync("public/companion-runtime.js", "utf8");
const multi = fs.readFileSync("public/companion-v3.js", "utf8");
const memoryTools = fs.readFileSync("public/companion-v4.js", "utf8");
const restoreCore = fs.readFileSync("public/companion-v5.js", "utf8");
const extras = fs.readFileSync("public/companion-extras.js", "utf8");
const css = fs.readFileSync("public/companion-profile-editor.css", "utf8");

assert.match(boot, /v9\.1-dual-mode/);
assert.match(boot, /companion-runtime\.js/);
assert.match(boot, /companion-extras\.js/);
assert.doesNotMatch(boot, /companion-reply-length\.js/);
assert.doesNotMatch(boot, /companion-v3-guard\.js/);
assert.doesNotMatch(boot, /companion-v8-secondary\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-v2\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-v6\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-profile-editor\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-v5-guard\.js/);

for (const retired of [
  "public/companion-v2.js",
  "public/companion-v2.css",
  "public/companion-v6.js",
  "public/companion-v6.css",
  "public/companion-profile-editor.js",
  "public/companion-v5-guard.js",
  "public/companion-reply-length.js",
  "public/companion-v3-guard.js",
  "public/companion-v8-secondary.js"
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
assert.match(controls, /完整角色设定/);
assert.doesNotMatch(controls, /COMPANION_ROLE_CARD/);

assert.match(runtime, /v9\.1-runtime/);
assert.match(runtime, /chars: 500/);
assert.match(runtime, /chars: 1000/);
assert.match(runtime, /chars: 5000/);
assert.match(runtime, /function patchCompanionBody\(/);
assert.match(runtime, /function blockUnsafeActions\(/);
assert.match(runtime, /function exportAllCharacters\(/);
assert.match(runtime, /function pruneOrphanedRoleData\(/);
assert.match(runtime, /window\.UnlimitedCompanionGuard = window\.UnlimitedCompanionRuntime/);
assert.match(runtime, /window\.UnlimitedCompanionReplyLength = window\.UnlimitedCompanionRuntime/);
assert.doesNotMatch(runtime, /COMPANION_ROLE_CARD/);

assert.doesNotMatch(multi, /function ensureCharacterBar/);
assert.doesNotMatch(multi, /function showCreateCharacter/);
assert.match(multi, /v8\.1-multichar-core/);

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

assert.match(extras, /v9\.1-extras/);
assert.match(extras, /ensureMessageActions/);
assert.match(extras, /ensureScrollBottom/);
assert.match(extras, /showMonthlyReview/);
assert.match(extras, /dataset\.v8EditCharacter/);
assert.match(extras, /moment\.textContent = "珍藏"/);
assert.doesNotMatch(extras, /rememberText/);
assert.doesNotMatch(extras, /uaiV8AdvancedMemory/);
assert.match(extras, /window\.UnlimitedCompanionV8Secondary = window\.UnlimitedCompanionExtras/);

assert.match(css, /uai-c-v8-note/);
assert.match(css, /uai-c-v8-message-actions/);
assert.match(css, /uai-c-v8-review-modal/);
assert.match(css, /uai-c-long-reply/);

console.log("Companion runtime/extras/core contract passed under V9 shell.");
