import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const entry = fs.readFileSync("public/companion-entry-v173.js", "utf8");
const loader = fs.readFileSync("public/companion-assets-loader.js", "utf8");
const v12Css = fs.readFileSync("public/companion-v12-final.css", "utf8");
const v12Js = fs.readFileSync("public/companion-v12-final.js", "utf8");

assert.match(index, /boot-diagnostics\.js\?v=20260821-v17\.3-companion-atomic-enhancements/);
assert.match(boot, /2026-08-21-v17\.3-companion-atomic-enhancements/);
assert.match(boot, /companion-entry-v173\.js/);
assert.doesNotMatch(boot, /companion-entry-v172\.js/);
assert.doesNotMatch(boot, /companion-lazy-bridge\.js/);

assert.match(entry, /function suppressEnhancementStyles\(/);
assert.match(entry, /link\.media = "not all"/);
assert.match(entry, /function stabilizeMessages\(/);
assert.match(entry, /container\.children\.length \|\| !expectedMessages/);
assert.match(entry, /UnlimitedCompanion\?\.mount/);
assert.match(entry, /setTimeout\(startEnhancements, 180\)/);

assert.match(loader, /2026-08-21-v17\.3-companion-atomic-enhancements/);
assert.match(loader, /inactive = false/);
assert.match(loader, /link\.media = "not all"/);
assert.match(loader, /function activateEnhancementStyles\(/);
assert.match(loader, /link\.media = "all"/);
assert.match(loader, /for \(const \[path, id\] of SCRIPT_ASSETS\)/);
assert.match(loader, /await stylePromise;\s*activateEnhancementStyles\(\)/s);
assert.match(loader, /deactivateEnhancementStyles\(\);[\s\S]*throw error/);

// V12.2 is the concrete regression case: its CSS adds a fourth grid row and its JS inserts
// the matching scene DOM. These must never be allowed to become active independently again.
assert.match(v12Css, /grid-template-rows:72px 292px minmax\(0,1fr\) auto!important/);
assert.match(v12Js, /className = "uai-c-v122-scene"/);
assert.match(v12Js, /main\.insertBefore\(scene,messages\)/);

console.log("Companion V17.3 atomic enhancement contract passed: structural theme CSS cannot activate before its matching JavaScript DOM is ready.");
