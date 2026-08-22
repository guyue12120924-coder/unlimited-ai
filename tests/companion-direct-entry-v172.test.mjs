import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("public/index.html");
const boot = read("public/boot-diagnostics.js");
const legacyEntry = read("public/companion-entry-v172.js");
const currentEntry = read("public/companion-entry-v175.js");

assert.match(index, /boot-diagnostics\.js\?v=20260822-v17\.5-companion-core-only-rollback/);
assert.match(boot, /2026-08-22-v17\.5-companion-core-only-rollback/);
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
  "core-only rollback must never start the optional enhancement bundle");

console.log("V17.2 direct-entry guarantees remain intact under the V17.5 core-only companion rollback.");