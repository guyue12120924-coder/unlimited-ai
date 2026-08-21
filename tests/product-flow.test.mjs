import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const index = read("public/index.html");
const app = read("public/app.js");
const runtime = read("public/v3-runtime.js");
const events = read("public/workspace-events-v166.js");
const sidebar = read("public/v3-sidebar.js");
const experience = read("public/v2-experience.js");
const novelV15 = read("public/novel-workspace-v15.js");
const userFlow = read("public/user-flow.js");
const aiToManuscript = read("public/ai-to-manuscript.js");
const phase1 = read("public/v2-product.js");
const phase2 = read("public/v2-product-phase2.js");
const phase3 = read("public/v2-product-phase3.js");

const runtimeIndex = index.indexOf("/v3-runtime.js");
const eventsIndex = index.indexOf("/workspace-events-v166.js");
const sidebarIndex = index.indexOf("/v3-sidebar.js");
const transportIndex = index.indexOf("/chat-transport-v16.js");
const appIndex = index.indexOf("/app.js");
const contextCoreIndex = index.indexOf("/chat-context-core-v163.js");
const memorySuggestIndex = index.indexOf("/memory-suggest.js");
const order = ["/user-flow.js","/ai-to-manuscript.js","/v2-experience.js","/v2-product.js","/v2-product-phase2.js","/v2-product-phase3.js"].map((item) => index.indexOf(item));

assert(transportIndex >= 0, "V16 chat transport must be loaded");
assert(appIndex > transportIndex, "V16 chat transport must load before the novel chat core");
assert(contextCoreIndex > appIndex, "V16.4 context providers must register after their workspace APIs initialize");
assert(memorySuggestIndex > contextCoreIndex, "later AI helpers must see the unified transport entry");
assert(runtimeIndex >= 0, "V16.5 runtime scheduler must be loaded");
assert(eventsIndex > runtimeIndex, "V16.6 workspace event hub must load after the scheduler");
assert(sidebarIndex > eventsIndex, "workspace event hub must load before product adapters");
assert(order.every((value) => value >= 0), "all product experience scripts must be loaded");
assert(order.every((value, position) => position === 0 || value > order[position - 1]), "product experience scripts must load in order");
assert(order.every((value) => value > sidebarIndex), "stable sidebar must load before every product experience adapter");

assert.match(index, /v3-product\.css/);
assert.match(index, /2026-08-21-v16\.6-event-runtime/);
assert.match(index, /history-lifecycle-v16\.js\?v=20260821-v16\.5/);
assert.match(index, /v3-runtime\.js\?v=20260821-v16\.5/);
assert.match(index, /workspace-events-v166\.js\?v=20260821-v16\.6/);
assert.match(index, /chat-transport-v16\.js\?v=20260821-v16\.4/);
assert.match(index, /app\.js\?v=20260821-v16\.6/);
assert.match(index, /v2-experience\.js\?v=20260821-v16\.6/);
assert.match(index, /novel-workspace-v15\.js\?v=20260821-v16\.6/);
assert.match(index, /chat-context-core-v163\.js\?v=20260821-v16\.4/);
assert.match(index, /novel-workspace-v154\.js\?v=20260818-v15\.4/);
assert.match(index, /<span>AI 小说创作<\/span>/);

assert.match(runtime, /2026-08-21-v16\.5-observer-scheduler/);
assert.match(runtime, /class ExplicitCoordinatedObserver/);
assert.match(runtime, /function createObserver\(callback\)/);
assert.match(runtime, /function schedule\(key, task\)/);
assert.match(runtime, /globalObserverUntouched/);
assert.doesNotMatch(runtime, /window\.MutationObserver\s*=/, "global MutationObserver must stay native");

assert.match(events, /2026-08-21-v16\.6-workspace-events/);
assert.match(events, /uai:\$\{name\}-refresh/);
assert.match(events, /function workspaceMutation\(/);
assert.match(events, /function chatMutation\(/);
assert.match(events, /function modeMutation\(/);
assert.match(events, /UnlimitedV3\?\.schedule/);
assert.match(events, /workspaceEventsRevision/);

assert.match(app, /syncHistoryPreferenceUi/);
assert.doesNotMatch(app, /LS_HISTORY_ENABLED|cfw_history_enabled/, "app core must not own the legacy history flag");
assert.doesNotMatch(app, /historyEnabled\s*=\s*true/, "app core must not force history persistence");
assert.doesNotMatch(app, /historyKeepEl\.disabled\s*=\s*true/, "app core must not disable the history preference");
assert.doesNotMatch(app, /historyKeepEl\.addEventListener\("change"/, "History Lifecycle must own the history toggle");
assert.match(app, /const requestSessionId = currentSessionId/);
assert.match(app, /let buffer = ""/);
assert.match(app, /currentAbortController === controller/);

assert.match(experience, /2026-08-21-v16\.6-v2-experience-events/);
assert.match(experience, /isPristineProject/);
assert.match(experience, /createFirstChapter/);
assert.match(experience, /uai:workspace-refresh/);
assert.doesNotMatch(experience, /new MutationObserver/, "V2 experience must use the shared workspace event hub");

assert.match(novelV15, /2026-08-21-v16\.6-novel-workspace-events/);
assert.match(novelV15, /uai:workspace-refresh/);
assert.doesNotMatch(novelV15, /new MutationObserver/, "V15 workspace must not observe the whole document itself");
assert.doesNotMatch(novelV15, /observe\(document\.body/, "V15 body-wide observation must stay removed");

assert.match(sidebar, /__UNLIMITED_NATIVE_MUTATION_OBSERVER__/);
assert.match(sidebar, /STATIC_LABELS/);
assert.match(sidebar, /UnlimitedV3Sidebar/);
assert.match(aiToManuscript, /加入正文/);
assert.match(userFlow, /nextChapterAction/);
assert.match(userFlow, /workflowCompleteChapter/);
assert.match(phase1, /data-v2-edit="polish"/);
assert.match(phase1, /替换原文/);
assert.match(phase1, /插入原文后/);
assert.match(phase2, /删除章节前/);
assert.match(phase2, /v210MobileNav/);
assert.match(phase3, /BACKUP_FORMAT = "unlimited-ai-backup"/);
assert.match(phase3, /exportCompleteBackup/);
assert.match(phase3, /restoreLocalData/);
assert.match(phase3, /runDiagnostics/);

console.log("V16.6 product contract passed: native observer scheduler -> shared workspace events -> history-neutral app core -> event-driven V2/V15 product layers.");
