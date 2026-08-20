import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const index = read("public/index.html");
const app = read("public/app.js");
const transport = read("public/chat-transport-v16.js");
const contextCore = read("public/chat-context-core-v163.js");
const contextBridge = read("public/context-bridge.js");
const memoryBridge = read("public/memory-bridge.js");
const continuityBridge = read("public/continuity-bridge.js");
const voiceWorker = read("src/worker-voice.js");

assert.match(index, /unlimited-runtime-revision" content="2026-08-21-v16\.4-runtime-core/);
for (const path of [
  "chat-transport-v16.js",
  "app.js",
  "context-bridge.js",
  "memory-bridge.js",
  "continuity-bridge.js",
  "chat-context-core-v163.js"
]) {
  assert.match(index, new RegExp(`${path.replaceAll(".", "\\.")}\\?v=20260821-v16\\.4`), `${path} must use the V16.4 cache revision`);
}

assert.match(transport, /2026-08-21-v16\.4-chat-transport/);
assert.match(transport, /2026-08-21-v16\.4-chat-registry/);
assert.doesNotMatch(transport, /lineBufferedBody|wrapNovelSse/, "transport must not duplicate SSE framing");
assert.match(transport, /registerNovelEnricher/);
assert.match(transport, /delete payload\.creative_context/);
assert.match(transport, /delete payload\.memory_context/);
assert.match(transport, /delete payload\.continuity_context/);

assert.doesNotMatch(contextBridge, /window\.fetch\s*=/, "creative-context bridge must be data/UI only");
assert.doesNotMatch(memoryBridge, /window\.fetch\s*=/, "memory bridge must be data/UI only");
assert.doesNotMatch(continuityBridge, /window\.fetch\s*=/, "continuity bridge must be data/UI only");
assert.match(contextBridge, /window\.UnlimitedContext/);
assert.match(contextBridge, /buildContext/);

assert.match(contextCore, /2026-08-21-v16\.4-chat-context-core/);
assert.match(contextCore, /UnlimitedContext\?\.buildContext/);
assert.match(contextCore, /window\.fetch = transport\.fetch/);
assert.match(contextCore, /registerNovelEnricher\("creative-context"/);
assert.match(contextCore, /registerNovelEnricher\("story-memory"/);
assert.match(contextCore, /registerNovelEnricher\("continuity"/);

assert.match(app, /const requestSessionId = currentSessionId/);
assert.match(app, /const requestMessages = requestSession\.messages/);
assert.match(app, /let buffer = ""/);
assert.match(app, /decoder\.decode\(value, \{ stream: true \}\)/);
assert.match(app, /currentAbortController === controller/);
assert.match(app, /requestMessages\.push\(\{ role: "assistant", content: full \}\)/);
assert.match(app, /persistSessionById\(requestSessionId, requestMessages\)/);

assert.match(voiceWorker, /function appCoreStatus\(/);
assert.match(voiceWorker, /function bridgeNetworkCleanupStatus\(/);
assert.match(voiceWorker, /legacyBridgeFetchWrappersRemoved: bridgeNetworkCleanup\.current/);
assert.match(voiceWorker, /coreRequestScopedSessions: appCore\.current/);
assert.match(voiceWorker, /coreSseParsing: appCore\.current/);
assert.match(voiceWorker, /revision: "2026-08-21-v16\.4-runtime-core"/);
assert.match(voiceWorker, /V16\.4 runtime cleanup/);

console.log("V16.4 runtime cleanup contract passed: dead fetch wrappers removed, canonical context builder, core-owned SSE/session state, cache revisions and diagnostics aligned.");
