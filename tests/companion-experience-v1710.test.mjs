import fs from "node:fs";
import assert from "node:assert/strict";

const index = fs.readFileSync("public/index.html", "utf8");
const js = fs.readFileSync("public/companion-experience-v1710.js", "utf8");
const css = fs.readFileSync("public/companion-experience-v1710.css", "utf8");

assert.match(index, /2026-08-22-v17\.10-safe-experience-restore/, "index must retain the V17.10 safe experience asset");
assert.match(index, /2026-08-23-v17\.19-luminous-full-canvas/, "index must advertise the current complete companion revision");
assert.match(index, /companion-experience-v1710\.css\?v=20260822-v17\.10-safe-experience-restore/, "V17.10 CSS must load");
assert.match(index, /companion-experience-v1710\.js\?v=20260822-v17\.10-safe-experience-restore/, "V17.10 JS must load");
assert.match(index, /companion-luminous-shell-v1719\.css\?v=20260823-v17\.19-luminous-full-canvas/, "V17.19 final visual shell must load");
assert.ok(index.indexOf("companion-runtime-safe-v179.js") < index.indexOf("companion-experience-v1710.js"), "V17.10 must load after V17.9");
assert.ok(index.indexOf("companion-atmosphere-v1715.css") < index.indexOf("companion-luminous-shell-v1719.css"), "V17.19 shell must load last among companion visual layers");

assert.doesNotMatch(js, /window\.fetch\s*=/, "V17.10 must not wrap fetch");
assert.doesNotMatch(js, /observe\s*\(\s*document\.body/, "V17.10 must not observe the whole body");
assert.doesNotMatch(js, /companion-v1[012]|live2d|call-mode/i, "V17.10 must not depend on structural companion stacks");
assert.doesNotMatch(js, /\/api\/companion\/tts/i, "V17.10 speech playback must remain local and not enable neural TTS");
assert.match(js, /speechSynthesis/, "V17.10 should use optional browser-local speech synthesis");
assert.match(js, /navigator\.mediaDevices\?\.getUserMedia/, "V17.10 voice input must be feature detected");
assert.match(js, /window\.MediaRecorder/, "V17.10 voice input must feature-detect MediaRecorder");
assert.match(js, /\/api\/companion\/stt/, "V17.10 may use the existing speech-to-text endpoint");
assert.match(js, /messageObserver\.observe\(container, \{ childList: true \}\)/, "V17.10 observer must be scoped to the message container");
assert.match(js, /fillComposer\(referencePrompt/, "message quick actions must fill the composer");
assert.doesNotMatch(js, /uaiCompanionSend[^\n]{0,120}\.click\s*\(/, "quick actions must not auto-send");
assert.match(js, /relationshipStage/, "V17.10 must expose relationship-stage UX");
assert.match(js, /uaiCompanionRelationshipV1710/, "V17.10 must add a relationship summary card");
assert.match(js, /继续聊/, "V17.10 must restore safe quick continuation actions");
assert.match(js, /换个说法/, "V17.10 must restore safe rephrase actions");

assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template/i, "V17.10 CSS must not alter core shell grid");
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template/i, "V17.10 CSS must not alter core main grid");
assert.doesNotMatch(css, /#uaiCompanionMessages\s*\{[^}]*(display\s*:\s*none|visibility\s*:\s*hidden)/i, "V17.10 CSS must not hide messages");
assert.match(css, /prefers-reduced-motion/, "V17.10 must respect reduced motion");

const order = [
  "companion-experience-v1710.js",
  "companion-voice-suite-v1711.js",
  "companion-scene-v1714.js",
  "companion-character-stage-v1712.js",
  "companion-call-suite-v1713.js",
  "companion-atmosphere-v1715.js",
  "companion-audio-gesture-v1716.js"
].map((asset) => index.indexOf(asset));
assert.ok(order.every((position) => position >= 0), "all restored companion layers must remain present in index");
assert.ok(order.every((position, index) => index === 0 || position > order[index - 1]), "restored companion layers must load in dependency order");

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
  "companion-luminous-shell-v1719.css"
]) assert.ok(index.includes(asset), `restored companion feature missing from active page: ${asset}`);

console.log("V17.19 complete companion experience contract passed");
await import('./companion-voice-suite-v1711.test.mjs');
await import('./companion-scene-v1714.test.mjs');
await import('./companion-character-stage-v1712.test.mjs');
await import('./companion-call-suite-v1713.test.mjs');
await import('./companion-atmosphere-v1715.test.mjs');
await import('./companion-audio-gesture-v1716.test.mjs');
await import('./companion-luminous-shell-v1719.test.mjs');
