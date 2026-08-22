import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const legacyLoader = fs.readFileSync("public/companion-assets-loader.js", "utf8");
const legacyBridge = fs.readFileSync("public/companion-lazy-bridge.js", "utf8");
const currentEntry = fs.readFileSync("public/companion-entry-v174.js", "utf8");
const currentLoader = fs.readFileSync("public/companion-assets-loader-v174.js", "utf8");

assert.match(index, /boot-diagnostics\.js\?v=20260822-v17\.4-companion-verified-commit/);
assert.match(boot, /2026-08-22-v17\.4-companion-verified-commit/);
assert.match(boot, /companion-entry-v174\.js/);
assert.doesNotMatch(boot, /companion-lazy-bridge\.js/,
  "legacy lazy bridge may remain as rollback source but must not be in the active boot chain");

assert.match(legacyLoader, /2026-08-20-v16\.0-companion-lazy-hardening/);
assert.match(legacyBridge, /COMPANION_ENTRY_TIMEOUT/);
assert.doesNotMatch(legacyBridge, /alert\(/, "entry recovery must stay inline and non-blocking");

assert.match(currentEntry, /ENTRY_TIMEOUT_MS = 2400/);
assert.match(currentEntry, /async function enterCore\(/);
assert.match(currentEntry, /companion router handoff failed; mounting verified core directly/);
assert.match(currentEntry, /async function hardReloadCore\(/);
assert.match(currentEntry, /async function stabilizeCore\(/);
assert.match(currentEntry, /companion-assets-loader-v174\.js/);
assert.match(currentLoader, /function waitForVerifiedDom\(/);
assert.match(currentLoader, /companionEnhancementCommit = "degraded"/);

console.log("Companion recovery contract passed: V17.4 keeps direct-core entry, hard core recovery, and verified enhancement fallback.");
