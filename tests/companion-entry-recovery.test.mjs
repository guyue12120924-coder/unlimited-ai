import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const loader = fs.readFileSync("public/companion-assets-loader.js", "utf8");
const legacyBridge = fs.readFileSync("public/companion-lazy-bridge.js", "utf8");
const currentEntry = fs.readFileSync("public/companion-entry-v173.js", "utf8");

assert.match(index, /boot-diagnostics\.js\?v=20260821-v17\.3-companion-atomic-enhancements/);
assert.match(boot, /2026-08-21-v17\.3-companion-atomic-enhancements/);
assert.match(boot, /companion-entry-v173\.js/);
assert.doesNotMatch(boot, /companion-lazy-bridge\.js/,
  "the V17.1 bridge may remain as rollback source but must not be in the active boot chain");

assert.match(loader, /2026-08-20-v16\.0-companion-lazy-hardening/);
assert.match(loader, /2026-08-21-v17\.1-companion-entry-recovery/);
assert.match(loader, /const CORE_SCRIPT = \["\/companion-mode\.js", "uaiCompanionScript"\]/);
assert.match(loader, /await ensureCore\(\)/);
assert.match(loader, /phase: "core-ready"/);

assert.match(legacyBridge, /2026-08-21-v17\.1-companion-entry-recovery/);
assert.match(legacyBridge, /ENTRY_TIMEOUT_MS = 2200/);
assert.match(legacyBridge, /function routerEntryWithWatchdog\(/);
assert.match(legacyBridge, /COMPANION_ENTRY_TIMEOUT/);
assert.match(legacyBridge, /COMPANION_ENTRY_INCOMPLETE/);
assert.doesNotMatch(legacyBridge, /alert\(/, "entry recovery must stay inline and non-blocking");

assert.match(currentEntry, /ENTRY_TIMEOUT_MS = 2200/);
assert.match(currentEntry, /function forceCoreEntry\(/);
assert.match(currentEntry, /router companion handoff failed; using direct core entry/);

console.log("Companion entry recovery guarantees from V17.1 remain preserved while V17.3 owns the active boot path.");
