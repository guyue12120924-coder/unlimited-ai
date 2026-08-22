import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const pack = fs.readFileSync("public/companion-function-pack-v177.js", "utf8");
const css = fs.readFileSync("public/companion-functional-v177.css", "utf8");

assert.match(index, /companion-function-pack-v177\.js\?v=20260822-v17\.7-safe-function-restore/);
assert.match(index, /companion-core-polish-v176\.css\?v=20260822-v17\.6-safe-polish/);
assert.match(boot, /companion-entry-v175\.js/);
assert.doesNotMatch(boot, /companion-assets-loader-v174\.js|companion-entry-v174\.js/);

for (const asset of [
  "companion-characters-core.js",
  "companion-character-editor.js",
  "companion-memory.js",
  "companion-records.js",
  "companion-extras.js"
]) assert.ok(pack.includes(asset), `V17.7 function pack must restore ${asset}`);

for (const forbidden of [
  "companion-runtime.js",
  "companion-settings.js",
  "companion-v10",
  "companion-v11",
  "companion-v12",
  "companion-live2d",
  "companion-assets-loader"
]) assert.ok(!pack.includes(forbidden), `V17.7 function pack must not load ${forbidden}`);

assert.match(pack, /uai:companion-core-entered/);
assert.match(pack, /requestIdleCallback/);
assert.match(pack, /optional companion functions degraded; core chat remains available/);
assert.doesNotMatch(pack, /window\.fetch\s*=/);

assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template-columns/s,
  "safe functional CSS must not replace the core shell columns");
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template-rows/s,
  "safe functional CSS must not replace the core main rows");
assert.doesNotMatch(css, /#uaiCompanionMessages[^}]*display\s*:\s*none/s);
assert.doesNotMatch(css, /#uaiCompanionInput[^}]*display\s*:\s*none/s);

console.log("V17.7 safe companion function restoration contract passed.");
