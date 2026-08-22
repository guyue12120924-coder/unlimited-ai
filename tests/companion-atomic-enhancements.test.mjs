import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("public/index.html");
const boot = read("public/boot-diagnostics.js");
const entry = read("public/companion-entry-v175.js");

assert.match(index, /boot-diagnostics\.js\?v=20260822-v17\.5-companion-core-only-rollback/);
assert.match(boot, /2026-08-22-v17\.5-companion-core-only-rollback/);
assert.match(boot, /companion-entry-v175\.js/);
assert.doesNotMatch(boot, /companion-entry-v174\.js/);
assert.doesNotMatch(boot, /companion-assets-loader-v174\.js/);
assert.doesNotMatch(boot, /companion-lazy-bridge\.js/);

assert.match(entry, /coreOnly: true/);
assert.match(entry, /\/companion-mode\.css\?v=/);
assert.match(entry, /\/companion-mode\.js\?v=/);
assert.match(entry, /function removeEnhancementResidue\(/);
assert.match(entry, /uaiCompanionAssetsLoaderV174Script/);
assert.match(entry, /querySelectorAll\("\[data-uai-companion-enhancement='true'\]"\)/);
assert.match(entry, /document\.documentElement\.dataset\.companionEnhancements = "disabled"/);
assert.match(entry, /async function hardReloadCore\(/);
assert.match(entry, /async function stabilizeCore\(/);
assert.match(entry, /async function prepareAndEnter\(/);
assert.match(entry, /await warmCore\(\)/);
assert.match(entry, /await enterCore\(\)/);
assert.doesNotMatch(entry, /startEnhancements/);
assert.doesNotMatch(entry, /companion-assets-loader-v174\.js/);
assert.doesNotMatch(entry, /UnlimitedCompanionAssetsV174/);

console.log("Companion V17.5 core-only rollback contract passed: only the base companion CSS/JS may participate in active entry, and all enhancement residue is disabled/removed.");