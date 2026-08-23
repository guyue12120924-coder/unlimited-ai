import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("public/index.html");
const boot = read("public/boot-diagnostics.js");
const legacyEntry = read("public/companion-entry-v172.js");
const currentEntry = read("public/companion-entry-v175.js");

assert.match(index, /boot-diagnostics\.js\?v=20260823-v17\.22-final-cleanup-diagnostics/);
assert.match(boot, /2026-08-23-v17\.22-final-cleanup-diagnostics/);
assert.match(boot, /companion-entry-v175\.js/);
assert.doesNotMatch(boot, /companion-lazy-bridge\.js/);

assert.match(legacyEntry, /function forceCoreEntry\(/);
assert.match(legacyEntry, /await warmCore\(\)/);
assert.match(legacyEntry, /await enterCore\(\)/);

assert.match(currentEntry, /\/companion-mode\.css\?v=/);
assert.match(currentEntry, /\/companion-mode\.js\?v=/);
assert.match(currentEntry, /async function prepareAndEnter\(/);
assert.match(currentEntry, /await warmCore\(\)/);
assert.match(currentEntry, /await enterCore\(\)/);
assert.match(currentEntry, /function directMount\(/);
assert.match(currentEntry, /async function hardReloadCore\(/);
assert.match(currentEntry, /document\.body\.dataset\.uaiMode = "companion"/);
assert.match(currentEntry, /window\.UnlimitedCompanion\.mount/);
assert.doesNotMatch(currentEntry, /startEnhancements|AssetsV174|assets-loader-v174/,
  "stable core entry must never start the obsolete enhancement bundle");

console.log("Direct-entry guarantees remain intact under V17.22 diagnostics: V17.5 core-only entry is still the production entry.");