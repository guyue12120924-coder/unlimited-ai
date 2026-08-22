import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const boot = read("public/boot-diagnostics.js");
const loader = read("public/companion-assets-loader-v174.js");
const core = read("public/companion-mode.js");
const editor = read("public/companion-character-editor.js");
const settings = read("public/companion-settings.js");
const runtime = read("public/companion-runtime.js");
const multi = read("public/companion-characters-core.js");
const memoryTools = read("public/companion-memory.js");
const restoreCore = read("public/companion-records.js");
const extras = read("public/companion-extras.js");
const css = read("public/companion-support.css");

assert.match(boot, /2026-08-22-v17\.4-companion-verified-commit/);
assert.match(boot, /companion-entry-v174\.js/);
for (const asset of [
  "companion-support.css", "companion-characters-core.js", "companion-character-editor.js",
  "companion-settings.js", "companion-memory.js", "companion-records.js",
  "companion-runtime.js", "companion-extras.js", "companion-v10.css", "companion-v10-shell.js",
  "companion-v12-ux-hardening.js"
]) assert.ok(loader.includes(asset), `V17.4 loader is missing ${asset}`);
assert.doesNotMatch(boot, /companion-v9\.css|companion-v9-shell\.js|companion-profile-editor\.css/);

for (const retired of [
  "public/companion-v2.js", "public/companion-v2.css", "public/companion-v6.js", "public/companion-v6.css",
  "public/companion-profile-editor.js", "public/companion-profile-editor.css", "public/companion-v5-guard.js",
  "public/companion-reply-length.js", "public/companion-v3-guard.js", "public/companion-v8-secondary.js",
  "public/companion-v3.js", "public/companion-create-controls.js", "public/companion-v4.js", "public/companion-v5.js",
  "public/companion-v3.css", "public/companion-v4.css", "public/companion-v5.css", "public/companion-characters-ui.js"
]) assert.equal(fs.existsSync(retired), false, `${retired} should stay retired`);

assert.match(core, /v8\.3-companion-core/);
assert.match(core, /let autoFollowStreaming = true/);
assert.match(core, /function bindStreamingScrollIntent\(/);
assert.match(core, /function renderMessages\(/);
assert.match(core, /function consumeSse\(/);

assert.match(editor, /v9\.3-character-editor/);
assert.match(editor, /PROFILE_LIMIT = 5000/);
assert.match(editor, /MAX_CHARACTERS = 6/);
assert.match(editor, /function openCreate\(/);
assert.match(editor, /function openEditor\(/);

assert.match(settings, /v9\.3-settings/);
assert.match(settings, /约 500 字/);
assert.match(settings, /约 1000 字/);
assert.match(settings, /约 5000 字/);

assert.match(runtime, /v9\.6-runtime/);
assert.match(runtime, /chars: 500/);
assert.match(runtime, /chars: 1000/);
assert.match(runtime, /chars: 5000/);
assert.match(runtime, /function patchCompanionBody\(/);
assert.match(runtime, /function blockUnsafeActions\(/);
assert.match(runtime, /function exportAllCharacters\(/);
assert.doesNotMatch(runtime, /COMPANION_ROLE_CARD/);

assert.match(multi, /v8\.1-multichar-core/);
assert.doesNotMatch(memoryTools, /new MutationObserver/);
assert.match(memoryTools, /clean\(message\?\.content, 12000\)/);
assert.match(restoreCore, /v8\.2-profile-restore-core/);
assert.match(restoreCore, /function normalizeSettings\(/);
assert.match(extras, /v9\.3-extras/);
assert.match(extras, /ensureMessageActions/);
assert.match(extras, /showMonthlyReview/);
assert.match(css, /#uaiV9RoleBackground/);
assert.match(css, /uai-c-v8-message-actions/);

console.log("Companion semantic runtime contract passed under the V17.4 verified loader.");
