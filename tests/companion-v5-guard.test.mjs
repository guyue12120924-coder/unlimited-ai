import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const guard = fs.readFileSync("public/companion-v5-guard.js", "utf8");

assert.match(boot, /companion-v5-guard\.js/);
assert.match(boot, /companionRestoreGuardReady/);

assert.match(guard, /uai_companion_characters_v1/);
assert.match(guard, /uai_companion_settings_v1/);
assert.match(guard, /uai_companion_import_rollback_v1/);
assert.match(guard, /function normalizeSettings\(/);
assert.match(guard, /VALID_REPLY_LENGTHS/);
assert.match(guard, /model:/);
assert.match(guard, /replyLength/);
assert.match(guard, /memoryEnabled/);
assert.match(guard, /7 \* 86400000/);
assert.match(guard, /UnlimitedCompanionRestoreGuard/);
assert.doesNotMatch(guard, /cfw_sessions_v2/);
assert.doesNotMatch(guard, /creative_context/);
assert.doesNotMatch(guard, /continuity_context/);
assert.doesNotMatch(guard, /storyMemory/);

console.log("Companion V5 restore guard contract passed: settings allowlist -> rollback expiry -> novel isolation.");
