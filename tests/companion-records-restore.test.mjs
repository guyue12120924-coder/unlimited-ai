import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const loader = fs.readFileSync("public/companion-assets-loader-v174.js", "utf8");
const restoreCore = fs.readFileSync("public/companion-records.js", "utf8");
const settings = fs.readFileSync("public/companion-settings.js", "utf8");
const sceneBackup = fs.readFileSync("public/companion-scene-backup.js", "utf8");

assert.match(boot, /2026-08-22-v17\.4-companion-verified-commit/);
assert.doesNotMatch(boot, /ensureScript\(`\/companion-v5-guard\.js/);
assert.match(loader, /companion-records\.js/);

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

const store = new Map();
const localStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
let uuidCounter = 0;
const document = {
  readyState: "complete",
  documentElement: { dataset: {} },
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  body: { appendChild() {} }
};
const validatedCore = {
  characters: [{
    id: "char-a",
    profile: { name: "A", relationship: "friend" },
    sessions: [],
    memories: [],
    settings: { model: "model-a", replyLength: "balanced", memoryEnabled: true }
  }],
  moments: { "char-a": [] },
  archive: { "char-a": [] },
  activeCharacterId: "char-a",
  version: 2
};
const window = {
  UnlimitedCompanionProfileRestore: {
    validateBackup() { return JSON.parse(JSON.stringify(validatedCore)); },
    restoreRollback() {}
  },
  UnlimitedCompanionMulti: { persist() {} }
};
const context = {
  window,
  document,
  localStorage,
  crypto: { randomUUID: () => `uuid-${++uuidCounter}` },
  console,
  JSON,
  Date,
  Math,
  Number,
  Object,
  Array,
  String,
  Boolean,
  Set,
  Map,
  alert() {},
  confirm() { return true; },
  location: { reload() {} },
  FileReader: class {},
  setTimeout,
  clearTimeout
};
vm.runInNewContext(sceneBackup, context, { filename: "companion-scene-backup.js" });
const sceneApi = window.UnlimitedCompanionSceneBackup;
assert.ok(sceneApi, "scene backup bridge should initialize");

write("uai_companion_characters_v1", [{ id: "old", profile: { name: "Old" }, sessions: [], memories: [], settings: {} }]);
localStorage.setItem("uai_companion_active_character_v1", "old");
write("uai_companion_profile_v1", { name: "Old" });
write("uai_companion_moments_v1", { old: [] });
write("uai_companion_memory_archive_v1", { old: [] });
write("uai_companion_scene_assignments_v1", {
  old: { theme: "neon", seed: 9, mode: "manual", assignedAt: 1 }
});

const incoming = sceneApi.validateRawBackup({
  format: "unlimited-ai-companion-multichar-backup",
  version: 2,
  characters: validatedCore.characters,
  activeCharacterId: "char-a",
  sceneAssignmentsByCharacter: {
    "char-a": {
      theme: "sakura",
      seed: 123,
      mode: "manual",
      assignedAt: 2,
      variant: { density: 1.1, bandOffset: 10, particleStyle: 1, welcomeIndex: 2, decorationIndex: 0, washX: 4, washY: -3 }
    }
  }
});
assert.equal(incoming.scenes["char-a"].theme, "sakura");
sceneApi.applyImportedBackup(incoming, "replace");
assert.equal(localStorage.getItem("uai_companion_active_character_v1"), "char-a");
assert.equal(read("uai_companion_scene_assignments_v1", {})["char-a"].theme, "sakura");
assert.equal(read("uai_companion_import_rollback_v1", {}).sceneAssignments.old.theme, "neon");

const mergePayload = {
  ...JSON.parse(JSON.stringify(incoming)),
  scenes: {
    "char-a": { theme: "moonlight", seed: 456, mode: "manual", assignedAt: 3 }
  }
};
sceneApi.applyImportedBackup(mergePayload, "merge");
const mergedCharacters = read("uai_companion_characters_v1", []);
assert.equal(mergedCharacters.length, 2);
const importedCharacter = mergedCharacters.find((item) => item.id !== "char-a");
assert.ok(importedCharacter, "ID collision should create a new character id");
assert.equal(read("uai_companion_scene_assignments_v1", {})[importedCharacter.id].theme, "moonlight");

console.log("Companion records/restore contract passed under the V17.4 loader.");
