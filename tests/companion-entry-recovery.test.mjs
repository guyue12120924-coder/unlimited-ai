import assert from "node:assert/strict";
import fs from "node:fs";

const loader = fs.readFileSync("public/companion-assets-loader.js", "utf8");
const bridge = fs.readFileSync("public/companion-lazy-bridge.js", "utf8");

assert.match(loader, /2026-08-21-v17\.1-companion-entry-recovery/);
assert.match(loader, /\["\/companion-mode\.js", "uaiCompanionScript"\]/);
assert.match(loader, /const \[coreAsset, \.\.\.extensionAssets\] = SCRIPT_ASSETS/);
assert.match(loader, /await loadScript\(coreAsset\[0\], coreAsset\[1\]\)/);
assert.match(loader, /if \(!window\.UnlimitedCompanion\?\.mount\)/);
assert.match(loader, /phase: "core-ready"/);
assert.match(loader, /extensionAssets\.map/);

const coreIndex = loader.indexOf('["/companion-mode.js", "uaiCompanionScript"]');
const firstExtensionIndex = loader.indexOf('["/companion-characters-core.js", "uaiCompanionCharactersCoreScript"]');
assert(coreIndex >= 0 && firstExtensionIndex > coreIndex, "companion core must be the first script asset");

assert.match(bridge, /2026-08-21-v17\.1-companion-entry-recovery/);
assert.match(bridge, /ENTRY_TIMEOUT_MS = 2200/);
assert.match(bridge, /function routerEntryWithWatchdog\(/);
assert.match(bridge, /COMPANION_ENTRY_TIMEOUT/);
assert.match(bridge, /COMPANION_ENTRY_INCOMPLETE/);
assert.match(bridge, /UnlimitedModeRouter\?\.showLobby\?\.\(\)/);
assert.match(bridge, /Always own the companion click/);
assert.doesNotMatch(bridge, /if \(window\.UnlimitedCompanionAssets\?\.ready\) return;/, "warm assets must not bypass the entry watchdog");
assert.doesNotMatch(bridge, /alert\(/, "companion entry recovery must stay inline and non-blocking");

console.log("Companion entry recovery contract passed: core-first lazy loading and watchdog recovery prevent a permanent OPEN HEART transition lock.");
