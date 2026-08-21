import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const index = read("public/index.html");
const app = read("public/app.js");
const runtime = read("public/v3-runtime.js");
const workspaceEvents = read("public/workspace-events-v166.js");
const experience = read("public/v2-experience.js");
const workspaceV17 = read("public/workspace-ui-v17.js");
const collaborationV17 = read("public/ai-collaboration-v17.js");
const storageCore = read("public/storage-core-v163.js");
const contextCore = read("public/chat-context-core-v163.js");
const contextBridge = read("public/context-bridge.js");
const memoryBridge = read("public/memory-bridge.js");
const continuityBridge = read("public/continuity-bridge.js");
const history = read("public/history-lifecycle-v16.js");
const transport = read("public/chat-transport-v16.js");
const loader = read("public/companion-assets-loader.js");
const migration = read("public/data-migration.js");
const worker = read("src/worker.js");
const voiceWorker = read("src/worker-voice.js");
const wrangler = read("wrangler.toml");

const storageIndex = index.indexOf("/storage-core-v163.js");
const migrationIndex = index.indexOf("/data-migration.js");
const historyIndex = index.indexOf("/history-lifecycle-v16.js");
const transportIndex = index.indexOf("/chat-transport-v16.js");
const appIndex = index.indexOf("/app.js");
const contextBridgeIndex = index.indexOf("/context-bridge.js");
const continuityBridgeIndex = index.indexOf("/continuity-bridge.js");
const memoryBridgeIndex = index.indexOf("/memory-bridge.js");
const contextCoreIndex = index.indexOf("/chat-context-core-v163.js");
const memorySuggestIndex = index.indexOf("/memory-suggest.js");
const runtimeIndex = index.indexOf("/v3-runtime.js");
const workspaceEventsIndex = index.indexOf("/workspace-events-v166.js");
const workspaceV17Index = index.indexOf("/workspace-ui-v17.js");
const collaborationV17Index = index.indexOf("/ai-collaboration-v17.js");

assert(storageIndex >= 0, "V16.3 storage core must exist in index.html");
assert(migrationIndex > storageIndex, "V16.3 storage core must load before data migration");
assert(historyIndex > storageIndex, "V16.5 history UI must load after Storage Core");
assert(transportIndex >= 0, "V16 chat transport must exist in index.html");
assert(appIndex > historyIndex, "V16.5 history UI must load before app.js");
assert(appIndex > transportIndex, "V16 chat transport must load before app.js");
assert(contextCoreIndex > contextBridgeIndex, "V16.4 context core must run after creative context initializes");
assert(contextCoreIndex > continuityBridgeIndex, "V16.4 context core must run after continuity initializes");
assert(contextCoreIndex > memoryBridgeIndex, "V16.4 context core must run after memory initializes");
assert(memorySuggestIndex > contextCoreIndex, "later AI helpers must see the single fetch entry");
assert(runtimeIndex > memorySuggestIndex, "V16.5 observer runtime must load after core chat/context wiring");
assert(workspaceEventsIndex > runtimeIndex, "V16.6 workspace event hub must load after the scheduler");
assert(workspaceV17Index > workspaceEventsIndex, "V17 workspace module must use the existing event runtime");
assert(collaborationV17Index > workspaceV17Index, "V17 collaboration module must initialize after workspace UI");

assert.match(index, /unlimited-runtime-revision" content="2026-08-21-v17\.0-workspace-consolidation/);
assert.match(index, /history-lifecycle-v16\.js\?v=20260821-v16\.5/);
assert.match(index, /v3-runtime\.js\?v=20260821-v16\.5/);
assert.match(index, /workspace-events-v166\.js\?v=20260821-v16\.6/);
assert.match(index, /chat-transport-v16\.js\?v=20260821-v16\.4/);
assert.match(index, /app\.js\?v=20260821-v16\.6/);
assert.match(index, /v2-experience\.js\?v=20260821-v16\.6/);
assert.match(index, /workspace-ui-v17\.js\?v=20260821-v17\.0/);
assert.match(index, /ai-collaboration-v17\.js\?v=20260821-v17\.0/);
assert.match(index, /context-bridge\.js\?v=20260821-v16\.4/);
assert.match(index, /continuity-bridge\.js\?v=20260821-v16\.4/);
assert.match(index, /memory-bridge\.js\?v=20260821-v16\.4/);
assert.match(index, /chat-context-core-v163\.js\?v=20260821-v16\.4/);

assert.match(storageCore, /2026-08-20-v16\.3-storage-core/);
assert.match(storageCore, /Object\.defineProperties\(Storage\.prototype/);
assert.match(storageCore, /writable: false/);
assert.match(storageCore, /window\.UnlimitedData/);
assert.match(storageCore, /cfw_history_persist_v16/);
assert.match(storageCore, /uai_v16_ephemeral_novel_sessions/);
assert.match(storageCore, /uai:storage-error/);

assert.match(history, /2026-08-21-v16\.5-history-ui/);
assert.match(history, /cfw_history_persist_v16/);
assert.match(history, /core\.setPersistence/);
assert.match(history, /event\.stopImmediatePropagation\(\)/);
assert.doesNotMatch(history, /Storage\.prototype\.(?:getItem|setItem|removeItem)\s*=/, "history UI must not patch Storage.prototype");

assert.match(runtime, /2026-08-21-v16\.5-observer-scheduler/);
assert.match(runtime, /function createObserver\(callback\)/);
assert.match(runtime, /function schedule\(key, task\)/);
assert.match(runtime, /globalObserverUntouched/);
assert.doesNotMatch(runtime, /window\.MutationObserver\s*=/, "runtime must not replace global MutationObserver");

assert.match(workspaceEvents, /2026-08-21-v16\.6-workspace-events/);
assert.match(workspaceEvents, /function workspaceMutation\(/);
assert.match(workspaceEvents, /function chatMutation\(/);
assert.match(workspaceEvents, /function modeMutation\(/);
assert.match(workspaceEvents, /UnlimitedV3\?\.schedule/);
assert.match(workspaceEvents, /uai:\$\{name\}-refresh/);

assert.match(app, /const requestSessionId = currentSessionId/);
assert.match(app, /const requestMessages = requestSession\.messages/);
assert.match(app, /persistSessionById\(requestSessionId, requestMessages\)/);
assert.match(app, /let buffer = ""/);
assert.match(app, /decoder\.decode\(value, \{ stream: true \}\)/);
assert.match(app, /if \(currentAbortController === controller\)/);
assert.match(app, /requestMessages\.push\(\{ role: "assistant", content: full \}\)/);
assert.match(app, /currentSessionId === requestSessionId/);
assert.match(app, /syncHistoryPreferenceUi/);
assert.doesNotMatch(app, /cfw_history_enabled|historyEnabled\s*=\s*true/);
assert.doesNotMatch(app, /historyKeepEl\.disabled\s*=\s*true/);
assert.doesNotMatch(app, /historyKeepEl\.addEventListener\("change"/);

assert.match(experience, /2026-08-21-v16\.6-v2-experience-events/);
assert.match(experience, /uai:workspace-refresh/);
assert.doesNotMatch(experience, /new MutationObserver/);
assert.match(workspaceV17, /2026-08-21-v17\.0-workspace-ui/);
assert.match(workspaceV17, /uai:workspace-refresh/);
assert.doesNotMatch(workspaceV17, /new MutationObserver/);
assert.match(collaborationV17, /2026-08-21-v17\.0-ai-collaboration/);
assert.match(collaborationV17, /uai:chat-refresh/);
assert.doesNotMatch(collaborationV17, /new MutationObserver/);

assert.match(transport, /2026-08-21-v16\.4-chat-transport/);
assert.match(transport, /2026-08-21-v16\.4-chat-registry/);
assert.match(transport, /function registerNovelEnricher\(/);
assert.match(transport, /function applyNovelEnrichers\(/);
assert.match(transport, /fetch: unlimitedStableFetch/);
assert.match(transport, /payload\.mode = "novel"/);
assert.match(transport, /delete payload\.creative_context/);
assert.match(transport, /delete payload\.memory_context/);
assert.match(transport, /delete payload\.continuity_context/);
assert.doesNotMatch(transport, /lineBufferedBody|wrapNovelSse/);
assert.match(transport, /blockRepeatSend/);
assert.match(transport, /blockRepeatEnter/);
assert.match(transport, /uai:storage-error/);

assert.match(contextBridge, /window\.UnlimitedContext/);
assert.match(contextBridge, /buildContext/);
assert.doesNotMatch(contextBridge, /window\.fetch\s*=/);
assert.doesNotMatch(memoryBridge, /window\.fetch\s*=/);
assert.doesNotMatch(continuityBridge, /window\.fetch\s*=/);

assert.match(contextCore, /2026-08-21-v16\.4-chat-context-core/);
assert.match(contextCore, /UnlimitedContext\?\.buildContext/);
assert.match(contextCore, /registerNovelEnricher\("creative-context"/);
assert.match(contextCore, /registerNovelEnricher\("story-memory"/);
assert.match(contextCore, /registerNovelEnricher\("continuity"/);
assert.match(contextCore, /window\.fetch = transport\.fetch/);

assert.match(migration, /function reportStorageError\(/);
assert.match(migration, /uai:storage-error/);
assert.match(loader, /2026-08-20-v16\.0-companion-lazy-hardening/);
assert.match(loader, /if \(link\.dataset\.uaiCompanionLazy === "true"\) link\.remove\(\)/);
assert.match(loader, /if \(script\.dataset\.uaiCompanionLazy === "true"\) script\.remove\(\)/);

assert.match(worker, /2026-08-21-v16\.4-worker-runtime-cleanup/);
assert.match(worker, /MAX_MODEL_ATTEMPTS = 3/);
assert.match(worker, /MAX_CHAT_BODY_BYTES = 768 \* 1024/);
assert.match(worker, /STREAM_IDLE_TIMEOUT_MS = 45000/);
assert.match(worker, /function trimConversationMessages\(/);
assert.match(worker, /function streamWithIdleTimeout\(/);
assert.match(worker, /function consumeRateLimit\(/);
assert.match(worker, /public, max-age=86400, stale-while-revalidate=604800/);
assert.doesNotMatch(worker.match(/function shouldFallback\(status\) \{[\s\S]*?\n\}/)?.[0] || "", /429/);

assert.match(wrangler, /main\s*=\s*"src\/worker-voice\.js"/);
assert.match(voiceWorker, /import worker from "\.\/worker\.js"/);
assert.match(voiceWorker, /2026-08-21-v16\.6-event-runtime-gateway|2026-08-21-v17\.0-workspace-gateway/);
assert.match(voiceWorker, /AI_GATEWAY_RATE_LIMITED/);
assert.match(voiceWorker, /AI_GATEWAY_FORBIDDEN/);
assert.match(voiceWorker, /BAD_CONTENT_TYPE/);
assert.match(voiceWorker, /function workspaceEventsStatus\(/);
assert.match(voiceWorker, /appHistoryNeutral: appCore\.current/);
assert.match(voiceWorker, /sharedWorkspaceEventHub: workspaceEvents\.current/);
assert.match(voiceWorker, /realWorkerEntry: "src\/worker-voice\.js"/);

console.log("V16 stability guarantees remain intact under V17 consolidated workspace delivery.");
