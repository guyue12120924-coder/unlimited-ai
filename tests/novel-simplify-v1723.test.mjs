import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const css = fs.readFileSync("public/novel-simplify-v1723.css", "utf8");
const js = fs.readFileSync("public/novel-simplify-v1723.js", "utf8");

assert.match(index, /unlimited-novel-revision" content="2026-08-23-v17\.23c-novel-navigation"/);
assert.match(index, /novel-simplify-v1723\.css\?v=20260823-v17\.23a-novel-simplification/);
assert.match(index, /novel-simplify-v1723\.js\?v=20260823-v17\.23a-novel-simplification/);
assert.ok(index.indexOf("/novel-simplify-v1723.css") < index.indexOf("/companion-core-polish-v176.css"));
assert.ok(index.indexOf("/novel-simplify-v1723.js") < index.indexOf("/companion-function-pack-v177.js"));

assert.match(css, /V17\.23A Novel Workspace Simplification/);
assert.match(css, /data-uai-mode="novel"/);
assert.match(css, /--bg-canvas:\s*#f3f0e9/);
assert.match(css, /\.novel-v151-guide/);
assert.match(css, /\.novel-v152-writing-now/);
assert.match(css, /#simpleManuscriptEditor/);
assert.doesNotMatch(css, /#uaiCompanionRoot|data-uai-mode="companion"|\.uai-c-/);

assert.match(js, /cfw_novel_theme_v1723/);
assert.match(js, /dataset\?\.uaiMode === "novel"/);
assert.match(js, /delete document\.body\.dataset\.novelV1723Theme/);
assert.match(js, /uai:mode-refresh/);
assert.doesNotMatch(js, /UnlimitedCompanion|uaiCompanionRoot/);

for (const asset of [
  "companion-voice-suite-v1711.js?v=20260823-v17.21-voice-experience-polish",
  "companion-character-stage-v1712.js?v=20260823-v17.21-emotional-lipsync-owner",
  "companion-call-suite-v1713.js?v=20260823-v17.21-call-voice-polish"
]) assert.ok(index.includes(asset));

assert.match(index, /<div id="bottom-spacer"><\/div><\/div><\/main>/);
console.log("V17.23A novel simplification contract remains intact under V17.23C.");
