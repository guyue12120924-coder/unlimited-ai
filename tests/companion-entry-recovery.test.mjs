import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const legacyBridge = fs.readFileSync("public/companion-lazy-bridge.js", "utf8");
const currentEntry = fs.readFileSync("public/companion-entry-v175.js", "utf8");

assert.match(index, /boot-diagnostics\.js\?v=20260822-v17\.5-companion-core-only-rollback/);
assert.match(boot, /2026-08-22-v17\.5-companion-core-only-rollback/);
assert.match(boot, /companion-entry-v175\.js/);
assert.doesNotMatch(boot, /companion-lazy-bridge\.js|companion-entry-v174\.js|companion-assets-loader-v174\.js/,
  "legacy/enhancement entry code must stay out of the active V17.5 boot chain");

assert.match(legacyBridge, /COMPANION_ENTRY_TIMEOUT/);
assert.doesNotMatch(legacyBridge, /alert\(/, "legacy recovery source must stay inline and non-blocking");

assert.match(currentEntry, /ENTRY_TIMEOUT_MS = 2600/);
assert.match(currentEntry, /async function enterCore\(/);
assert.match(currentEntry, /companion router handoff failed; using core-only direct mount/);
assert.match(currentEntry, /async function hardReloadCore\(/);
assert.match(currentEntry, /async function stabilizeCore\(/);
assert.match(currentEntry, /removeEnhancementResidue\(\)/);
assert.match(currentEntry, /root\.querySelector\("#uaiCompanionMessages"\)/);
assert.match(currentEntry, /root\.querySelector\("#uaiCompanionInput"\)/);
assert.doesNotMatch(currentEntry, /startEnhancements|UnlimitedCompanionAssetsV174|assets-loader-v174/);

console.log("Companion recovery contract passed: V17.5 keeps direct-core entry and hard recovery while all optional enhancement loading remains disabled.");