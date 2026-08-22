import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("public/index.html");
const boot = read("public/boot-diagnostics.js");
const legacyEntry = read("public/companion-entry-v172.js");
const currentEntry = read("public/companion-entry-v174.js");

assert.match(index, /boot-diagnostics\.js\?v=20260822-v17\.4-companion-verified-commit/);
assert.match(boot, /2026-08-22-v17\.4-companion-verified-commit/);
assert.match(boot, /companion-entry-v174\.js/);
assert.doesNotMatch(boot, /\["\/companion-lazy-bridge\.js",\s*"uaiCompanionLazyBridgeScript"\]/,
  "legacy lazy bridge must not regain ownership of companion entry");

assert.match(legacyEntry, /function forceCoreEntry\(/);
assert.match(legacyEntry, /await warmCore\(\)/);
assert.match(legacyEntry, /await enterCore\(\)/);
assert.match(legacyEntry, /optional companion enhancements failed; core chat remains available/);

assert.match(currentEntry, /\/companion-mode\.css\?v=/);
assert.match(currentEntry, /\/companion-mode\.js\?v=/);
assert.match(currentEntry, /async function prepareAndEnter\(/);
assert.match(currentEntry, /await warmCore\(\)/);
assert.match(currentEntry, /await enterCore\(\)/);
assert(currentEntry.indexOf("await enterCore()") < currentEntry.indexOf("window.setTimeout(startEnhancements, 180)"),
  "optional enhancements must still start only after the base companion page enters");
assert.match(currentEntry, /function directMount\(/);
assert.match(currentEntry, /async function hardReloadCore\(/);
assert.match(currentEntry, /document\.body\.dataset\.uaiMode = "companion"/);
assert.match(currentEntry, /window\.UnlimitedCompanion\.mount/);
assert.doesNotMatch(currentEntry, /await .*Assets.*load\(\).*enterCore/s,
  "full enhancement bundle must never block entering the companion core");

console.log("V17.2 direct-entry guarantees remain intact under the V17.4 verified companion entry.");
