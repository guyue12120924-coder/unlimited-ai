import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const boot = read("public/boot-diagnostics.js");
const runtime = read("public/companion-live2d.js");
const css = read("public/companion-live2d.css");
const config = JSON.parse(read("public/live2d/characters.json"));
const readme = read("public/live2d/README.md");

assert.match(boot, /companion-live2d\.css/);
assert.match(boot, /companion-live2d\.js/);
assert.match(boot, /companionLive2dReady/);
assert.match(boot, /v12\.(?:9|10)-live2d/);

assert.match(runtime, /v12\.10-live2d-sample/);
assert.match(runtime, /uai_companion_live2d_assignments_v1/);
assert.match(runtime, /pixi\.js@6\.5\.10/);
assert.match(runtime, /pixi-live2d-display@0\.4\.0/);
assert.match(runtime, /\/live2d\/vendor\/live2dcubismcore\.min\.js/);
assert.doesNotMatch(runtime, /cubism\.live2d\.com\/sdk-web\/cubismcore/);
assert.match(runtime, /async function probeModel\(/);
assert.match(runtime, /async function selectAvailableSpec\(/);
assert.match(runtime, /spec\.fallback\?\.model/);
assert.match(runtime, /await selectAvailableSpec\(configured\)/);
assert.match(runtime, /await ensureRuntime\(\)/);
assert.ok(runtime.indexOf("await selectAvailableSpec(configured)") < runtime.indexOf("await ensureRuntime()"), "model availability must be resolved before heavy Live2D dependencies are loaded");
assert.match(runtime, /缺少 Cubism Core/);
assert.match(runtime, /data-live2d-credit/);
assert.match(runtime, /官方测试模型/);
assert.match(runtime, /autoInteract: false/);
assert.match(runtime, /idleMotionGroup/);
assert.match(runtime, /currentModel\.focus/);
assert.match(runtime, /currentModel\.tap/);
assert.match(runtime, /setEmotion/);
assert.match(runtime, /setExpression/);
assert.match(runtime, /playMotion/);
assert.match(runtime, /setMouthOpen/);
assert.match(runtime, /ticker\?\.stop/);
assert.match(runtime, /ticker\?\.start/);
assert.match(runtime, /window\.UnlimitedCompanionLive2D/);

assert.match(css, /\.uai-c-live2d-layer/);
assert.match(css, /z-index:4/);
assert.match(css, /uai-c-live2d-active/);
assert.match(css, /\.uai-c-v122-portrait-wrap/);
assert.match(css, /\.uai-c-live2d-credit/);
assert.match(css, /\.uai-c-live2d-status-note/);

assert.equal(config.version, 2);
assert.equal(config.byName?.["李萌"]?.model, "/live2d/characters/limeng/limeng.model3.json");
assert.equal(config.byName?.["李萌"]?.idleMotionGroup, "Idle");
assert.ok(Array.isArray(config.byName?.["李萌"]?.tapMotionGroups));
const fallback = config.byName?.["李萌"]?.fallback;
assert.ok(fallback, "李萌 should have an official test fallback until the real model is provided");
assert.match(fallback.model, /^https:\/\/raw\.githubusercontent\.com\/Live2D\/CubismWebSamples\//);
assert.match(fallback.model, /\/Samples\/Resources\/Mao\/Mao\.model3\.json$/);
assert.equal(fallback.sample?.name, "Mao");
assert.equal(fallback.sample?.owner, "Live2D Inc.");

assert.match(readme, /public\/live2d\/characters\/limeng/);
assert.match(readme, /live2dcubismcore\.min\.js/);
assert.match(readme, /official Live2D `Mao` sample/i);
assert.match(readme, /setModelForCharacter/);
assert.doesNotMatch(readme, /fall back to Live2D's official hosted Cubism Core URL/i);

// Cubism Core is proprietary and must not be committed into this public repo.
assert.equal(fs.existsSync("public/live2d/vendor/live2dcubismcore.min.js"), false);

console.log("Companion Live2D contract passed: local model -> official sample fallback -> local official Core -> interactions/API.");
