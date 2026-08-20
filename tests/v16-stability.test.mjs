import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const index = read("public/index.html");
const storageCore = read("public/storage-core-v163.js");
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
assert(storageIndex >= 0, "V16.3 storage core must exist in index.html");
assert(migrationIndex > storageIndex, "V16.3 storage core must load before data migration");
assert(historyIndex > storageIndex, "V16.3 storage core must load before history lifecycle");
assert(transportIndex >= 0, "V16 chat transport must exist in index.html");
assert(appIndex > historyIndex, "V16.1 history lifecycle must load before app.js");
assert(appIndex > transportIndex, "V16 chat transport must load before app.js");
assert.match(index, /unlimited-runtime-revision" content="2026-08-20-v16\.3-storage-core/);

assert.match(storageCore, /2026-08-20-v16\.3-storage-core/);
assert.match(storageCore, /Object\.defineProperties\(Storage\.prototype/);
assert.match(storageCore, /writable: false/);
assert.match(storageCore, /function normalizeValue\(/);
assert.match(storageCore, /window\.UnlimitedData/);
assert.match(storageCore, /cfw_history_persist_v16/);
assert.match(storageCore, /uai_v16_ephemeral_novel_sessions/);
assert.match(storageCore, /uai:storage-error/);
assert.match(storageCore, /window\.UnlimitedStorageV163/);

assert.match(history, /2026-08-20-v16\.1-history-lifecycle/);
assert.match(history, /cfw_history_persist_v16/);
assert.match(history, /uai_v16_ephemeral_novel_sessions/);
assert.match(history, /sessionStorage/);
assert.match(history, /persistAcrossReloads/);
assert.match(history, /event\.stopImmediatePropagation\(\)/, "V16.1 must own the legacy history toggle event");
assert.match(history, /applyPreference/);
assert.match(history, /刷新后不会恢复这些对话/);
assert.doesNotMatch(transport, /function enforceLocalFirstHistory\(/, "transport must not force history persistence back on");
assert.doesNotMatch(transport, /自动保存/, "transport must not disable the user's history preference");

assert.match(transport, /2026-08-20-v16\.0-chat-transport/);
assert.match(transport, /function normalizePayloadMode\(/);
assert.match(transport, /payload\.mode = "novel"/, "legacy novel requests must leave the browser with an explicit mode");
assert.match(transport, /function lineBufferedBody\(/, "novel SSE must be normalized across network chunks");
assert.match(transport, /payload\.mode !== "companion"/);
assert.match(transport, /delete payload\.creative_context/);
assert.match(transport, /delete payload\.memory_context/);
assert.match(transport, /delete payload\.continuity_context/);
assert.match(transport, /signal\?\.aborted/, "user stop must close the normalized stream cleanly");
assert.match(transport, /当前已经收到的内容会保留/, "user stop must explain that partial output is preserved");
assert.match(transport, /#sessionList \.session-title/);
assert.match(transport, /#studioSessionList/);
assert.match(transport, /#commandResults/);
assert.match(transport, /#workspaceSearchResults/);
assert.match(transport, /blockRepeatSend/);
assert.match(transport, /blockRepeatEnter/);
assert.match(transport, /uai:storage-error/);

assert.match(migration, /function reportStorageError\(/);
assert.match(migration, /__UNLIMITED_STORAGE_ERROR__/);
assert.match(migration, /uai:storage-error/);

assert.match(loader, /2026-08-20-v16\.0-companion-lazy-hardening/);
assert.match(loader, /if \(link\.dataset\.uaiCompanionLazy === "true"\) link\.remove\(\)/);
assert.match(loader, /if \(script\.dataset\.uaiCompanionLazy === "true"\) script\.remove\(\)/);

assert.match(worker, /2026-08-20-v16\.0-worker-stability/);
assert.match(worker, /MAX_MODEL_ATTEMPTS = 3/);
assert.match(worker, /MAX_CHAT_BODY_BYTES = 768 \* 1024/);
assert.match(worker, /STREAM_IDLE_TIMEOUT_MS = 45000/);
assert.match(worker, /function trimConversationMessages\(/);
assert.match(worker, /slice\(0, MAX_MODEL_ATTEMPTS\)/);
assert.match(worker, /function streamWithIdleTimeout\(/);
assert.match(worker, /function consumeRateLimit\(/);
assert.match(worker, /Cross-site API request blocked/);
assert.match(worker, /public, max-age=86400, stale-while-revalidate=604800/);
assert.doesNotMatch(
  worker.match(/function shouldFallback\(status\) \{[\s\S]*?\n\}/)?.[0] || "",
  /429/,
  "HTTP 429 must not fan out across fallback models"
);

assert.match(wrangler, /main\s*=\s*"src\/worker-voice\.js"/, "wrangler must deploy the gateway wrapper as the real Worker entry");
assert.match(voiceWorker, /import worker from "\.\/worker\.js"/, "real Worker entry must delegate non-voice requests to worker.js");
assert.match(voiceWorker, /2026-08-20-v16\.2-ai-gateway/);
assert.match(voiceWorker, /PROTECTED_POST_ROUTES/);
assert.match(voiceWorker, /JSON_POST_ROUTES/);
assert.match(voiceWorker, /function consumeApiRate\(/);
assert.match(voiceWorker, /AI_GATEWAY_RATE_LIMITED/);
assert.match(voiceWorker, /AI_GATEWAY_FORBIDDEN/);
assert.match(voiceWorker, /BAD_CONTENT_TYPE/);
assert.match(voiceWorker, /return false;\n}/, "gateway must reject protected requests when both Origin and Fetch Metadata are absent");
assert.match(voiceWorker, /contentType\.startsWith\("application\/json"\)/);
assert.match(voiceWorker, /function historyLifecycleStatus\(/);
assert.match(voiceWorker, /history-lifecycle-v16\.js/);
assert.match(voiceWorker, /realWorkerEntry: "src\/worker-voice\.js"/);
assert.match(voiceWorker, /function diagnosticsResponse\(/);

console.log("V16 stability contract passed: V16.3 single storage gateway, real Worker gateway diagnostics, explicit modes, user-controlled ephemeral history, request isolation, line-safe SSE, preserved stops, storage errors, bounded fallback, API guards and lazy retry hardening.");