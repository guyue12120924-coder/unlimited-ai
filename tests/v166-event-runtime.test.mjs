import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const index = read("public/index.html");
const app = read("public/app.js");
const hub = read("public/workspace-events-v166.js");
const v2 = read("public/v2-experience.js");
const legacyLayers = [
  ["V15.0 workspace", read("public/novel-workspace-v15.js")],
  ["V15.1 story desk", read("public/novel-workspace-v151.js")],
  ["V15.2 manuscript flow", read("public/novel-workspace-v152.js")],
  ["V15.3 reply actions", read("public/novel-workspace-v153.js")]
];
const workspaceV17 = read("public/workspace-ui-v17.js");
const collaborationV17 = read("public/ai-collaboration-v17.js");
const gateway = read("src/worker-voice.js");

assert.match(index, /2026-08-21-v17\.0-workspace-consolidation/);
assert.match(index, /workspace-events-v166\.js\?v=20260821-v16\.6/);
assert.match(index, /v2-experience\.js\?v=20260821-v16\.6/);
assert.match(index, /app\.js\?v=20260821-v16\.6/);
assert.match(index, /workspace-ui-v17\.js\?v=20260821-v17\.0/);
assert.match(index, /ai-collaboration-v17\.js\?v=20260821-v17\.0/);
for (const file of ["novel-workspace-v15.js", "novel-workspace-v151.js", "novel-workspace-v152.js", "novel-workspace-v153.js"]) {
  assert.doesNotMatch(index, new RegExp(`<script[^>]+${file.replaceAll(".", "\\.")}`), `${file} must remain unloaded after V17 consolidation`);
}

assert.match(hub, /2026-08-21-v16\.6-workspace-events/);
assert.match(hub, /new Observer\(workspaceMutation\)/);
assert.match(hub, /new Observer\(chatMutation\)/);
assert.match(hub, /new Observer\(modeMutation\)/);
assert.match(hub, /attributeFilter: \["class", "data-added-chapter-id"\]/);
assert.match(hub, /uai:\$\{name\}-refresh/);
assert.match(hub, /UnlimitedV3\?\.schedule/);

assert.match(v2, /2026-08-21-v16\.6-v2-experience-events/);
for (const [name, source] of legacyLayers) {
  assert.doesNotMatch(source, /new MutationObserver/, `${name} rollback source must not reintroduce a private MutationObserver`);
}
assert.match(workspaceV17, /uai:workspace-refresh/);
assert.match(workspaceV17, /uai:mode-refresh/);
assert.match(collaborationV17, /uai:workspace-refresh/);
assert.match(collaborationV17, /uai:chat-refresh/);
assert.match(collaborationV17, /uai:mode-refresh/);
assert.doesNotMatch(workspaceV17, /new MutationObserver/);
assert.doesNotMatch(collaborationV17, /new MutationObserver/);

assert.match(app, /syncHistoryPreferenceUi/);
assert.doesNotMatch(app, /cfw_history_enabled/);
assert.doesNotMatch(app, /historyEnabled\s*=\s*true/);
assert.doesNotMatch(app, /historyKeepEl\.disabled\s*=\s*true/);
assert.doesNotMatch(app, /historyKeepEl\.addEventListener\("change"/);

assert.match(gateway, /2026-08-21-v16\.6-event-runtime-gateway/);
assert.match(gateway, /sharedWorkspaceEventHub: workspaceEvents\.current/);
assert.match(gateway, /appHistoryNeutral: appCore\.current/);

console.log("V16.6 guarantees remain intact under V17: one event hub, history-neutral app core, and no private V15/V17 observers.");
