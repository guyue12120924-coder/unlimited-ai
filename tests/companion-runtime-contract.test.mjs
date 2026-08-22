import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const boot = read("public/boot-diagnostics.js");
const entry = read("public/companion-entry-v175.js");
const core = read("public/companion-mode.js");
const editor = read("public/companion-character-editor.js");
const settings = read("public/companion-settings.js");
const runtime = read("public/companion-runtime.js");
const multi = read("public/companion-characters-core.js");
const memoryTools = read("public/companion-memory.js");
const restoreCore = read("public/companion-records.js");
const extras = read("public/companion-extras.js");

assert.match(boot, /2026-08-22-v17\.5-companion-core-only-rollback/);
assert.match(boot, /companion-entry-v175\.js/);
for (const asset of [
  "companion-character-editor.js", "companion-settings.js", "companion-memory.js",
  "companion-records.js", "companion-runtime.js", "companion-extras.js",
  "companion-v10-shell.js", "companion-v12-ux-hardening.js"
]) {
  assert.doesNotMatch(boot, new RegExp(asset.replaceAll(".", "\\.")), `${asset} must stay out of the active boot chain`);
  assert.doesNotMatch(entry, new RegExp(asset.replaceAll(".", "\\.")), `${asset} must stay out of the V17.5 entry`);
}

assert.match(core, /v8\.3-companion-core/);
assert.match(core, /let autoFollowStreaming = true/);
assert.match(core, /function bindStreamingScrollIntent\(/);
assert.match(core, /function renderMessages\(/);
assert.match(core, /function consumeSse\(/);
assert.match(core, /mode: "companion"/);

assert.match(editor, /v9\.3-character-editor/);
assert.match(settings, /v9\.3-settings/);
assert.match(runtime, /v9\.6-runtime/);
assert.match(multi, /v8\.1-multichar-core/);
assert.match(memoryTools, /clean\(message\?\.content, 12000\)/);
assert.match(restoreCore, /v8\.2-profile-restore-core/);
assert.match(extras, /v9\.3-extras/);

console.log("Companion runtime contract passed: the V8.3 core owns active chat while later optional runtime modules remain dormant under V17.5.");