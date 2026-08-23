import fs from "node:fs";
import assert from "node:assert/strict";

const index = fs.readFileSync("public/index.html", "utf8");
const js = fs.readFileSync("public/companion-experience-v1710.js", "utf8");
const css = fs.readFileSync("public/companion-experience-v1710.css", "utf8");

assert.match(index, /2026-08-22-v17\.10-safe-experience-restore/);
assert.match(index, /2026-08-23-v17\.21-voice-experience-polish/);
assert.match(index, /companion-experience-v1710\.css\?v=20260822-v17\.10-safe-experience-restore/);
assert.match(index, /companion-experience-v1710\.js\?v=20260822-v17\.10-safe-experience-restore/);
assert.match(index, /companion-voice-suite-v1711\.js\?v=20260823-v17\.21-voice-experience-polish/);
assert.match(index, /companion-character-stage-v1712\.js\?v=20260823-v17\.21-emotional-lipsync-owner/);
assert.match(index, /companion-call-suite-v1713\.js\?v=20260823-v17\.21-call-voice-polish/);
assert.match(index, /companion-voice-polish-v1721\.css\?v=20260823-v17\.21-call-voice-polish/);
assert.match(index, /companion-luminous-shell-v1719\.css\?v=20260823-v17\.19-luminous-full-canvas/);
assert.ok(index.indexOf("companion-runtime-safe-v179.js") < index.indexOf("companion-experience-v1710.js"));
assert.ok(index.indexOf("companion-voice-suite-v1711.js") < index.indexOf("companion-character-stage-v1712.js"));
assert.ok(index.indexOf("companion-character-stage-v1712.js") < index.indexOf("companion-call-suite-v1713.js"));
assert.ok(index.indexOf("companion-atmosphere-v1715.css") < index.indexOf("companion-luminous-shell-v1719.css"));

assert.doesNotMatch(js, /window\.fetch\s*=/);
assert.doesNotMatch(js, /observe\s*\(\s*document\.body/);
assert.doesNotMatch(js, /companion-v1[012]|live2d|call-mode/i);
assert.doesNotMatch(js, /\/api\/companion\/tts/i);
assert.match(js, /speechSynthesis/);
assert.match(js, /navigator\.mediaDevices\?\.getUserMedia/);
assert.match(js, /\/api\/companion\/stt/);
assert.match(js, /messageObserver\.observe\(container, \{ childList: true \}\)/);
assert.doesNotMatch(js, /uaiCompanionSend[^\n]{0,120}\.click\s*\(/);
assert.match(js, /relationshipStage/);
assert.match(js, /继续聊/);
assert.match(js, /换个说法/);
assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template/i);
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template/i);
assert.match(css, /prefers-reduced-motion/);

const order = [
  "companion-experience-v1710.js",
  "companion-voice-suite-v1711.js",
  "companion-scene-v1714.js",
  "companion-character-stage-v1712.js",
  "companion-call-suite-v1713.js",
  "companion-atmosphere-v1715.js",
  "companion-audio-gesture-v1716.js"
].map((asset) => index.indexOf(asset));
assert.ok(order.every((position) => position >= 0));
assert.ok(order.every((position, itemIndex) => itemIndex === 0 || position > order[itemIndex - 1]));

for (const asset of [
  "companion-function-pack-v177.js",
  "companion-controls-v178.js",
  "companion-runtime-safe-v179.js",
  "companion-experience-v1710.js",
  "companion-voice-suite-v1711.js",
  "companion-scene-v1714.js",
  "companion-character-stage-v1712.js",
  "companion-call-suite-v1713.js",
  "companion-atmosphere-v1715.js",
  "companion-audio-gesture-v1716.js",
  "companion-voice-polish-v1721.css",
  "companion-luminous-shell-v1719.css"
]) assert.ok(index.includes(asset), `restored companion feature missing from active page: ${asset}`);

console.log("V17.21 complete companion experience contract passed");
await import('./companion-voice-suite-v1711.test.mjs');
await import('./companion-scene-v1714.test.mjs');
await import('./companion-character-stage-v1712.test.mjs');
await import('./companion-call-suite-v1713.test.mjs');
await import('./companion-atmosphere-v1715.test.mjs');
await import('./companion-audio-gesture-v1716.test.mjs');
await import('./companion-luminous-shell-v1719.test.mjs');