import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("public/index.html");
const boot = read("public/boot-diagnostics.js");
const entry = read("public/companion-entry-v174.js");
const loader = read("public/companion-assets-loader-v174.js");
const phase1 = read("public/companion-v12-phase1.js");
const phase4 = read("public/companion-v12-phase4-themes.js");
const v12Css = read("public/companion-v12-final.css");
const v12Js = read("public/companion-v12-final.js");

assert.match(index, /boot-diagnostics\.js\?v=20260822-v17\.4-companion-verified-commit/);
assert.match(boot, /2026-08-22-v17\.4-companion-verified-commit/);
assert.match(boot, /companion-entry-v174\.js/);
assert.doesNotMatch(boot, /companion-entry-v17[123]\.js/,
  "only the V17.4 verified entry may own companion clicks");
assert.doesNotMatch(boot, /companion-lazy-bridge\.js/);

assert.match(entry, /companion-assets-loader-v174\.js/);
assert.match(entry, /function suppressEnhancementStyles\(/);
assert.match(entry, /uaiCompanionLive2dNeuralVoiceCss/,
  "entry suppression IDs must match the loader exactly");
assert.match(entry, /async function hardReloadCore\(/);
assert.match(entry, /function expectedMessages\(/);
assert.match(entry, /async function stabilizeCore\(\)[\s\S]*document\.body\.dataset\.uaiMode !== "companion"/);
assert.match(entry, /querySelectorAll\("\.uai-c-message-row"\)/);
assert.match(entry, /rendered < expected/);
assert.match(entry, /async function startEnhancements\(\)[\s\S]*document\.body\.dataset\.uaiMode !== "companion"/);
assert.match(entry, /if \(!committed \|\| document\.body\.dataset\.uaiMode !== "companion"\)/);
assert.match(entry, /function handleModeRefresh\(/);
assert.match(entry, /uai:mode-refresh/);
assert.match(entry, /window\.setTimeout\(\(\) => \{[\s\S]*startEnhancements\(\)/);

assert.match(loader, /2026-08-22-v17\.4-companion-verified-commit/);
for (const asset of [
  "companion-v12-phase2-background.css", "companion-v12-phase2-background.js",
  "companion-v12-phase3-character.css", "companion-v12-phase3-character.js",
  "companion-v12-phase4-themes.css", "companion-v12-phase4-themes.js",
  "companion-v12-phase5-scene-state.css", "companion-v12-phase5-scene-state.js",
  "companion-live2d-interaction.css", "companion-live2d-interaction.js"
]) {
  assert(loader.includes(asset), `${asset} must be owned by the V17.4 central loader`);
}
assert.match(loader, /function predeclareScripts\(/);
assert.match(loader, /uaiCompanionScriptPlaceholder/);
assert.match(loader, /link\?\.dataset\.uaiLoaded === "false"/);
assert.match(loader, /script\?\.dataset\.uaiLoaded === "false"/);
assert.match(loader, /if \(link\.dataset\.uaiCompanionEnhancement === "true"\) link\.remove\(\)/);
assert.match(loader, /if \(script\.dataset\.uaiCompanionEnhancement === "true"\) script\.remove\(\)/);
assert.match(loader, /link\.media = "not all"/);
assert.match(loader, /function structureReady\(\)[\s\S]*if \(!companionActive\(\)\) return false/);
assert.match(loader, /function waitForVerifiedDom\([\s\S]*if \(!companionActive\(\)\) \{\s*resolve\(false\)/);
assert.match(loader, /function recommit\(/);
assert.match(loader, /if \(state\.assetsReady\) return recommit\(\)/);
assert.match(loader, /await waitForVerifiedDom\(\)/);
assert.match(loader, /function activateStyles\(/);
assert.match(loader, /link\.media = "all"/);
assert(loader.indexOf("const verified = await waitForVerifiedDom()") < loader.indexOf("activateStyles();"),
  "enhancement CSS must activate only after required DOM is verified");
assert.match(loader, /companionEnhancementCommit = "deferred"/);
assert.match(loader, /companionEnhancementCommit = "degraded"/);
assert.match(loader, /suppressStyles\(\)/);

assert.doesNotMatch(phase1, /function ensureStyle\(|function ensureScript\(|loadPhaseEnhancements\(/,
  "phase 1 must never start a secondary resource loader again");
assert.match(phase1, /uai:companion-enhancements-commit/);
assert.match(phase1, /commitStyles/);
assert.doesNotMatch(phase4, /function ensureStyle\(|function ensureScript\(|loadPhase5SceneState\(/,
  "phase 4 must never start a secondary resource loader again");
assert.match(phase4, /companion-assets-loader-v174\.js/);

// Concrete regression: this CSS changes the shell/main grid, while JS supplies the matching DOM.
assert.match(v12Css, /grid-template-rows:72px 292px minmax\(0,1fr\) auto!important/);
assert.match(v12Js, /className = "uai-c-v122-scene"/);
assert.match(v12Js, /main\.insertBefore\(scene,messages\)/);

console.log("Companion V17.4 verified-commit contract passed: one loader owns all structural enhancements, retry/exit lifecycle is guarded, CSS activates only after DOM verification, and core messages have a recovery path.");
