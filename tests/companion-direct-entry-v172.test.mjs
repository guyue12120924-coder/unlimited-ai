import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("public/index.html");
const boot = read("public/boot-diagnostics.js");
const legacyEntry = read("public/companion-entry-v172.js");
const currentEntry = read("public/companion-entry-v173.js");

assert.match(index, /boot-diagnostics\.js\?v=20260821-v17\.3-companion-atomic-enhancements/);
assert.match(boot, /2026-08-21-v17\.3-companion-atomic-enhancements/);
assert.match(boot, /companion-entry-v173\.js/);
assert.doesNotMatch(boot, /\["\/companion-lazy-bridge\.js",\s*"uaiCompanionLazyBridgeScript"\]/,
  "legacy lazy bridge must not regain ownership of companion entry");

// The historical V17.2 file remains as a rollback reference and documents the direct-core
// guarantee introduced in that release.
assert.match(legacyEntry, /function forceCoreEntry\(/);
assert.match(legacyEntry, /await warmCore\(\)/);
assert.match(legacyEntry, /await enterCore\(\)/);
assert.match(legacyEntry, /optional companion enhancements failed; core chat remains available/);

// V17.3 must preserve the same direct-core guarantee while adding atomic enhancement activation.
assert.match(currentEntry, /\/companion-mode\.css\?v=/);
assert.match(currentEntry, /\/companion-mode\.js\?v=/);
assert.match(currentEntry, /async function prepareAndEnter\(/);
assert.match(currentEntry, /await warmCore\(\)/);
assert.match(currentEntry, /await enterCore\(\)/);
assert(currentEntry.indexOf("await enterCore()") < currentEntry.indexOf("window.setTimeout(startEnhancements, 180)"),
  "optional enhancements must still start only after the base companion page enters");
assert.match(currentEntry, /function forceCoreEntry\(/);
assert.match(currentEntry, /document\.body\.dataset\.uaiMode = "companion"/);
assert.match(currentEntry, /window\.UnlimitedCompanion\.mount/);
assert.doesNotMatch(currentEntry, /await .*Assets.*load\(\).*enterCore/s,
  "full enhancement bundle must never block entering the companion core");

console.log("V17.2 direct-entry guarantees remain intact under the V17.3 atomic enhancement entry.");
