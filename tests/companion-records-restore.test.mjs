import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const entry = fs.readFileSync("public/companion-entry-v175.js", "utf8");
const restoreCore = fs.readFileSync("public/companion-records.js", "utf8");
const settings = fs.readFileSync("public/companion-settings.js", "utf8");
const sceneBackup = fs.readFileSync("public/companion-scene-backup.js", "utf8");

assert.match(boot, /2026-08-22-v17\.5-companion-core-only-rollback/);
assert.doesNotMatch(boot, /companion-records\.js|companion-settings\.js|companion-scene-backup\.js/);
assert.doesNotMatch(entry, /companion-records\.js|companion-settings\.js|companion-scene-backup\.js/);

assert.match(restoreCore, /uai_companion_characters_v1/);
assert.match(restoreCore, /uai_companion_settings_v1/);
assert.match(restoreCore, /uai_companion_import_rollback_v1/);
assert.match(restoreCore, /function normalizeSettings\(/);
assert.match(restoreCore, /function normalizeStoredSettings\(/);
assert.match(restoreCore, /function pruneExpiredRollback\(/);
assert.match(restoreCore, /VALID_REPLY_LENGTHS/);
assert.doesNotMatch(restoreCore, /cfw_sessions_v2|creative_context|continuity_context|storyMemory/);

assert.match(settings, /companion-scene-backup\.js/);
assert.match(settings, /UnlimitedCompanionSceneBackup/);
assert.match(sceneBackup, /uai_companion_scene_assignments_v1/);
assert.match(sceneBackup, /sceneAssignmentsByCharacter/);
assert.match(sceneBackup, /function sanitizeAssignment\(/);
assert.match(sceneBackup, /function sanitizeSceneMap\(/);
assert.match(sceneBackup, /function applyImportedBackup\(/);
assert.doesNotMatch(sceneBackup, /cfw_sessions_v2|creative_context|continuity_context/);

console.log("Companion restore/scene-backup sources remain intact but dormant under the V17.5 core-only rollback.");