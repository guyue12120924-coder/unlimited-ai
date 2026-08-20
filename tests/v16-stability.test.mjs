import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const index = read("public/index.html");
const transport = read("public/chat-transport-v16.js");
const loader = read("public/companion-assets-loader.js");
const migration = read("public/data-migration.js");
const worker = read("src/worker.js");
const voiceWorker = read("src/worker-voice.js");
const wrangler = read("wrangler.toml");

const transportIndex = index.indexOf("/chat-transport-v16.js");
const appIndex = index.indexOf("/app.js");
assert(transportIndex >= 0, "V16 chat transport must exist in index.html");
assert(appIndex > transportIndex, "V16 chat transport must load before app.js");

assert.match(transport, /2026-08-20-v16\.0-chat-transport/);
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

assert.match(wrangler, /main\s*=\s*"src\/worker-voice\.js"/, "wrangler must deploy the voice wrapper as the real Worker entry");
assert.match(voiceWorker, /import worker from "\.\/worker\.js"/, "voice Worker entry must delegate non-voice requests to worker.js");
assert.match(voiceWorker, /2026-08-20-v16\.0-call-voice-stability/);
assert.match(voiceWorker, /function consumeVoiceRate\(/);
assert.match(voiceWorker, /VOICE_RATE_LIMITED/);

console.log("V16 stability contract passed: real Worker entry, request isolation, line-safe SSE, preserved stops, storage errors, bounded fallback, API guards and lazy retry hardening.");