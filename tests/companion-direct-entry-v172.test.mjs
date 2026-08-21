import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("public/index.html");
const boot = read("public/boot-diagnostics.js");
const entry = read("public/companion-entry-v172.js");

assert.match(index, /boot-diagnostics\.js\?v=20260821-v17\.2-companion-direct-core-entry/);
assert.match(boot, /2026-08-21-v17\.2-companion-direct-core-entry/);
assert.match(boot, /companion-entry-v172\.js/);
assert.doesNotMatch(boot, /\["\/companion-lazy-bridge\.js",\s*"uaiCompanionLazyBridgeScript"\]/,
  "legacy lazy bridge must not own companion entry after V17.2");

assert.match(entry, /\/companion-mode\.css\?v=/);
assert.match(entry, /\/companion-mode\.js\?v=/);
assert.match(entry, /async function prepareAndEnter\(/);
assert.match(entry, /await warmCore\(\)/);
assert.match(entry, /await enterCore\(\)/);
assert.match(entry, /window\.setTimeout\(startEnhancements, 0\)/);
assert(entry.indexOf("await enterCore()") < entry.indexOf("window.setTimeout(startEnhancements, 0)"),
  "optional enhancements must start only after the core page enters");
assert.match(entry, /function forceCoreEntry\(/);
assert.match(entry, /router companion handoff failed; using direct core entry/);
assert.match(entry, /document\.body\.dataset\.uaiMode = "companion"/);
assert.match(entry, /window\.UnlimitedCompanion\.mount/);
assert.match(entry, /optional companion enhancements failed; core chat remains available/);
assert.doesNotMatch(entry, /await loader\.load\(\).*enterCore/s,
  "full enhancement bundle must never block entering the companion core");

console.log("V17.2 companion direct-entry contract passed: base companion chat opens before optional enhancement loading.");