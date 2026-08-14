import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const core = fs.readFileSync("public/companion-mode.js", "utf8");
const editor = fs.readFileSync("public/companion-character-editor.js", "utf8");
const settings = fs.readFileSync("public/companion-settings.js", "utf8");
const runtime = fs.readFileSync("public/companion-runtime.js", "utf8");
const multi = fs.readFileSync("public/companion-characters-core.js", "utf8");
const memoryTools = fs.readFileSync("public/companion-memory.js", "utf8");
const restoreCore = fs.readFileSync("public/companion-records.js", "utf8");
const extras = fs.readFileSync("public/companion-extras.js", "utf8");
const css = fs.readFileSync("public/companion-profile-editor.css", "utf8");

assert.match(boot, /v9\.4-dual-mode/);
assert.match(boot, /companion-characters-core\.js/);
assert.match(boot, /companion-character-editor\.js/);
assert.match(boot, /companion-settings\.js/);
assert.match(boot, /companion-memory\.js/);
assert.match(boot, /companion-records\.js/);
assert.match(boot, /companion-runtime\.js/);
assert.match(boot, /companion-extras\.js/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-characters-ui\.js/);

for (const retired of [
  "public/companion-v2.js",
  "public/companion-v2.css",
  "public/companion-v6.js",
  "public/companion-v6.css",
  "public/companion-profile-editor.js",
  "public/companion-v5-guard.js",
  "public/companion-reply-length.js",
  "public/companion-v3-guard.js",
  "public/companion-v8-secondary.js",
  "public/companion-v3.js",
  "public/companion-create-controls.js",
  "public/companion-v4.js",
  "public/companion-v5.js",
  "public/companion-v3.css",
  "public/companion-v4.css",
  "public/companion-v5.css"
]) {
  assert.equal(fs.existsSync(retired), false, `${retired} should stay retired`);
}

assert.match(core, /v8\.3-companion-core/);
assert.match(core, /let autoFollowStreaming = true/);
assert.match(core, /let pendingMessageScrollTop = null/);
assert.match(core, /function bindStreamingScrollIntent\(/);

assert.match(editor, /v9\.3-character-editor/);
assert.match(editor, /PROFILE_LIMIT = 5000/);
assert.match(editor, /MAX_CHARACTERS = 6/);
assert.match(editor, /function openCreate\(/);
assert.match(editor, /function openEditor\(/);
assert.match(editor, /完整角色设定/);
assert.doesNotMatch(editor, /COMPANION_ROLE_CARD/);
assert.doesNotMatch(editor, /ensureRoleToolbar/);

assert.match(settings, /v9\.3-settings/);
assert.match(settings, /约 500 字/);
assert.match(settings, /约 1000 字/);
assert.match(settings, /约 5000 字/);
assert.match(settings, /uaiV9DataPanel/);

assert.match(runtime, /v9\.1-runtime/);
assert.match(runtime, /chars: 500/);
assert.match(runtime, /chars: 1000/);
assert.match(runtime, /chars: 5000/);
assert.match(runtime, /function patchCompanionBody\(/);
assert.match(runtime, /function blockUnsafeActions\(/);
assert.match(runtime, /function exportAllCharacters\(/);
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
assert.match(restoreCore, /function normalizeSettings\(/);
assert.match(restoreCore, /function pruneExpiredRollback\(/);

assert.match(extras, /v9\.3-extras/);
assert.match(extras, /ensureMessageActions/);
assert.match(extras, /ensureLongReplies/);
assert.match(extras, /ensureScrollBottom/);
assert.match(extras, /uaiV9RelationshipRecord/);
assert.match(extras, /showMonthlyReview/);
assert.doesNotMatch(extras, /rememberText/);

assert.match(css, /uai-c-v8-note/);
assert.match(css, /uai-c-v8-message-actions/);
assert.match(css, /uai-c-v8-review-modal/);
assert.match(css, /uai-c-long-reply/);

console.log("Companion semantic module contract passed under V9.4 shell.");
