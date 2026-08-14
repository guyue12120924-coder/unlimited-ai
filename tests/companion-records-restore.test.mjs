import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const restoreCore = fs.readFileSync("public/companion-records.js", "utf8");
const settings = fs.readFileSync("public/companion-settings.js", "utf8");
const sceneBackup = fs.readFileSync("public/companion-scene-backup.js", "utf8");

assert.doesNotMatch(boot, /ensureScript\(`\/companion-v5-guard\.js/);
assert.match(boot, /companion-records\.js/);

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

assert.match(settings, /companion-scene-backup\.js/);
assert.match(settings, /UnlimitedCompanionSceneBackup/);
assert.match(settings, /function openBackupImport\(/);
assert.match(settings, /function restoreBackupRollback\(/);

assert.match(sceneBackup, /uai_companion_scene_assignments_v1/);
assert.match(sceneBackup, /sceneAssignmentsByCharacter/);
assert.match(sceneBackup, /function sanitizeAssignment\(/);
assert.match(sceneBackup, /function sanitizeSceneMap\(/);
assert.match(sceneBackup, /function applyImportedBackup\(/);
assert.match(sceneBackup, /sceneAssignments:/);
assert.match(sceneBackup, /writeJson\(KEYS\.scenes/);
assert.match(sceneBackup, /const core = window\.UnlimitedCompanionProfileRestore/);
assert.match(sceneBackup, /core\.validateBackup\(raw\)/);
assert.doesNotMatch(sceneBackup, /cfw_sessions_v2/);
assert.doesNotMatch(sceneBackup, /creative_context/);
assert.doesNotMatch(sceneBackup, /continuity_context/);

console.log("Companion records/restore contract passed: core restore + per-character scene backup bridge + novel isolation.");
