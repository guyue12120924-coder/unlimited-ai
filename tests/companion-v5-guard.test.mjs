import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const restoreCore = fs.readFileSync("public/companion-v5.js", "utf8");

assert.doesNotMatch(boot, /ensureScript\(`\/companion-v5-guard\.js/);

assert.match(restoreCore, /uai_companion_characters_v1/);
assert.match(restoreCore, /uai_companion_settings_v1/);
assert.match(restoreCore, /uai_companion_import_rollback_v1/);
assert.match(restoreCore, /function normalizeSettings\(/);
assert.match(restoreCore, /function normalizeStoredSettings\(/);
assert.match(restoreCore, /function pruneExpiredRollback\(/);
assert.match(restoreCore, /VALID_REPLY_LENGTHS/);
assert.match(restoreCore, /settings: normalizeSettings\(raw\.settings\)/);
assert.match(restoreCore, /writeJson\(KEYS\.settings, normalizeSettings\(character\.settings\)\)/);
assert.match(restoreCore, /7 \* 86400000/);
assert.doesNotMatch(restoreCore, /cfw_sessions_v2/);
assert.doesNotMatch(restoreCore, /creative_context/);
assert.doesNotMatch(restoreCore, /continuity_context/);
assert.doesNotMatch(restoreCore, /storyMemory/);

console.log("Companion restore core contract passed: settings allowlist -> rollback expiry -> novel isolation.");
