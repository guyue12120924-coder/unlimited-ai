import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const index = read("public/index.html");
const app = read("public/app.js");
const hub = read("public/workspace-events-v166.js");
const v2 = read("public/v2-experience.js");
const v150 = read("public/novel-workspace-v15.js");
const v151 = read("public/novel-workspace-v151.js");
const v152 = read("public/novel-workspace-v152.js");
const v153 = read("public/novel-workspace-v153.js");
const gateway = read("src/worker-voice.js");

assert.match(index, /2026-08-21-v16\.6-event-runtime/);
for (const file of [
  "workspace-events-v166.js",
  "v2-experience.js",
  "novel-workspace-v15.js",
  "novel-workspace-v151.js",
  "novel-workspace-v152.js",
  "novel-workspace-v153.js"
]) {
  assert.match(index, new RegExp(`${file.replaceAll(".", "\\.")}\\?v=20260821-v16\\.6`), `${file} must use the V16.6 cache key`);
}
assert.match(index, /app\.js\?v=20260821-v16\.6/);

assert.match(hub, /2026-08-21-v16\.6-workspace-events/);
assert.match(hub, /new Observer\(workspaceMutation\)/);
assert.match(hub, /new Observer\(chatMutation\)/);
assert.match(hub, /new Observer\(modeMutation\)/);
assert.match(hub, /attributeFilter: \["class", "data-added-chapter-id"\]/);
assert.match(hub, /uai:\$\{name\}-refresh/);
assert.match(hub, /UnlimitedV3\?\.schedule/);

assert.match(v2, /2026-08-21-v16\.6-v2-experience-events/);
assert.match(v150, /2026-08-21-v16\.6-novel-workspace-events/);
assert.match(v151, /2026-08-21-v16\.6-story-desk-events/);
assert.match(v152, /2026-08-21-v16\.6-manuscript-flow-events/);
assert.match(v153, /2026-08-21-v16\.6-reply-actions-events/);

for (const [name, source] of [
  ["V2 experience", v2],
  ["V15.0 workspace", v150],
  ["V15.1 story desk", v151],
  ["V15.2 manuscript flow", v152],
  ["V15.3 reply actions", v153]
]) {
  assert.doesNotMatch(source, /new MutationObserver/, `${name} must not own a private MutationObserver`);
}

assert.match(v2, /uai:workspace-refresh/);
assert.match(v150, /uai:workspace-refresh/);
assert.match(v151, /uai:workspace-refresh/);
assert.match(v152, /uai:workspace-refresh/);
assert.match(v152, /uai:chat-refresh/);
assert.match(v153, /uai:chat-refresh/);
assert.match(v153, /uai:mode-refresh/);

assert.match(app, /syncHistoryPreferenceUi/);
assert.doesNotMatch(app, /cfw_history_enabled/);
assert.doesNotMatch(app, /historyEnabled\s*=\s*true/);
assert.doesNotMatch(app, /historyKeepEl\.disabled\s*=\s*true/);
assert.doesNotMatch(app, /historyKeepEl\.addEventListener\("change"/);

assert.match(gateway, /2026-08-21-v16\.6-event-runtime-gateway/);
assert.match(gateway, /sharedWorkspaceEventHub: workspaceEvents\.current/);
assert.match(gateway, /appHistoryNeutral: appCore\.current/);

console.log("V16.6 event runtime contract passed: one shared DOM event hub, event-driven V2/V15 layers and history-neutral app core.");
