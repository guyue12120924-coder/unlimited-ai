import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("public/index.html");
const boot = read("public/boot-diagnostics.js");
const worker = read("src/worker-voice.js");
const deploy = JSON.parse(read("public/deploy-status.json"));
const readme = read("README.md");
const legacy = read("docs/COMPANION_LEGACY.md");

assert.match(index, /unlimited-diagnostics-revision" content="2026-08-23-v17\.22-final-cleanup-diagnostics"/);
assert.match(index, /boot-diagnostics\.js\?v=20260823-v17\.22-final-cleanup-diagnostics/);
assert.match(index, /companion-voice-suite-v1711\.js\?v=20260823-v17\.21-voice-experience-polish/);
assert.match(index, /companion-character-stage-v1712\.js\?v=20260823-v17\.21-emotional-lipsync-owner/);
assert.match(index, /companion-call-suite-v1713\.js\?v=20260823-v17\.21-call-voice-polish/);
assert.doesNotMatch(index, /<script[^>]+companion-v1[012]/);
assert.doesNotMatch(index, /<script[^>]+\/companion-runtime\.js/);
assert.doesNotMatch(index, /<script[^>]+\/companion-call-mode\.js/);
assert.doesNotMatch(index, /<script[^>]+\/companion-live2d\.js/);

assert.match(boot, /BOOT_REVISION = "2026-08-23-v17\.22-final-cleanup-diagnostics"/);
assert.match(boot, /function companionSnapshot\(\)/);
assert.match(boot, /UnlimitedCompanionVoiceV1711/);
assert.match(boot, /UnlimitedCompanionStageV1712/);
assert.match(boot, /UnlimitedCompanionCallV1713/);
assert.match(boot, /legacyCompanionStructuralThemesDisabled/);

assert.match(worker, /2026-08-23-v17\.22-companion-diagnostics-gateway/);
assert.match(worker, /defaultVoice: "eve"/);
assert.match(worker, /function voiceStatus\(/);
assert.match(worker, /function live2dStatus\(/);
assert.match(worker, /function sceneStatus\(/);
assert.match(worker, /function callStatus\(/);
assert.match(worker, /legacyStructuralThemesUnloaded/);
assert.doesNotMatch(worker, /conclusion: frontendCurrent\s*\? "V17\.0 workspace consolidation is current/);

assert.equal(deploy.frontendRevision, "2026-08-23-v17.21-voice-experience-polish");
assert.equal(deploy.diagnosticsRevision, "2026-08-23-v17.22-final-cleanup-diagnostics");
assert.equal(deploy.workerGatewayRevision, "2026-08-23-v17.22-companion-diagnostics-gateway");
assert.ok(String(deploy.status || "").length > 0);

assert.match(readme, /V17\.22 Final Cleanup & Diagnostics/);
assert.match(readme, /V17\.21/);
assert.match(readme, /docs\/COMPANION_LEGACY\.md/);
assert.match(legacy, /Do not load in production/);
assert.match(legacy, /companion-v10\*/);
assert.match(legacy, /companion-v11\*/);
assert.match(legacy, /companion-v12\*/);
assert.match(legacy, /companion-entry-v175\.js/);

console.log("V17.22 diagnostics contract passed independently of the current novel UI revision.");
