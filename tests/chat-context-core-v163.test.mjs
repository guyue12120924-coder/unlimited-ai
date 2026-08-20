import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { TextDecoder, TextEncoder } from "node:util";

const transportSource = fs.readFileSync("public/chat-transport-v16.js", "utf8");
const contextCoreSource = fs.readFileSync("public/chat-context-core-v163.js", "utf8");

class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
}

const localStorage = new FakeStorage();
const sessionStorage = new FakeStorage();
const nativeRequests = [];
const nativeFetch = async (input, init = {}) => {
  nativeRequests.push({ input, init });
  return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
};

const project = {
  id: "project-1",
  name: "测试小说",
  synopsis: "一段简介",
  outline: "总体大纲",
  world: "测试世界",
  notes: "保持第一人称",
  timeline: "第一天",
  foreshadow: "钥匙仍未解释",
  relations: [{ from: "林雨桐", to: "顾辰", type: "同伴" }],
  characters: [
    { name: "林雨桐", personality: "冷静" },
    { name: "顾辰", personality: "谨慎" }
  ],
  chapters: [
    { id: "chapter-1", title: "第一章", summary: "来到旧宅", notes: "夜晚", targetWords: 3000 }
  ]
};
localStorage.setItem("cfw_studio_workspace_v1", JSON.stringify({
  activeProjectId: "project-1",
  activeChapterId: "chapter-1",
  projects: [project]
}));
localStorage.setItem("cfw_context_prefs_v1", JSON.stringify({ enabled: true }));

const document = {
  body: { dataset: { uaiMode: "novel" } },
  documentElement: { dataset: {} },
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; }
};

const sandbox = {
  window: null,
  document,
  localStorage,
  sessionStorage,
  fetch: nativeFetch,
  Response,
  ReadableStream,
  TextDecoder,
  TextEncoder,
  CustomEvent: class CustomEvent {},
  setTimeout,
  clearTimeout,
  getComputedStyle() { return { display: "none" }; },
  console
};
sandbox.window = sandbox;
sandbox.addEventListener = () => {};
sandbox.dispatchEvent = () => true;

const context = vm.createContext(sandbox);
vm.runInContext(transportSource, context, { filename: "chat-transport-v16.js" });

const stableFetch = context.UnlimitedChatTransportV16.fetch;
assert.equal(context.UnlimitedChatTransportV16.registryRevision, "2026-08-20-v16.3-chat-registry");

// Simulate the legacy context/memory/continuity wrappers that used to remain on the
// global network path after their files loaded.
const legacyWrappedFetch = async (...args) => stableFetch(...args);
context.fetch = legacyWrappedFetch;

context.UnlimitedMemory = {
  selectRelevantMemories(payload) {
    return payload.mode === "novel"
      ? [{ id: "mem-1", type: "伏笔", content: "地下室钥匙尚未使用", importance: 5, status: "active" }]
      : [];
  }
};
context.UnlimitedContinuity = {
  currentPayload() {
    return {
      version: 1,
      chapterId: "chapter-1",
      chapterSummary: "林雨桐进入旧宅",
      previousChapterSummary: "",
      characterStates: [{ name: "林雨桐", state: "手里拿着钥匙" }]
    };
  }
};

vm.runInContext(contextCoreSource, context, { filename: "chat-context-core-v163.js" });

assert.equal(context.UnlimitedChatContextV163.installed, true);
assert.equal(context.fetch, stableFetch, "V16.3 must remove legacy fetch wrappers from the active network path");
assert.deepEqual(
  [...context.UnlimitedChatTransportV16.enrichers],
  ["creative-context", "story-memory", "continuity"]
);

await context.fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "test-model",
    messages: [{ role: "user", content: "继续写林雨桐打开地下室" }]
  })
});

const novelPayload = JSON.parse(nativeRequests.at(-1).init.body);
assert.equal(novelPayload.mode, "novel");
assert.equal(novelPayload.creative_context.project.name, "测试小说");
assert.equal(novelPayload.creative_context.chapter.title, "第一章");
assert.equal(novelPayload.creative_context.characters.length, 2);
assert.equal(novelPayload.memory_context.items[0].content, "地下室钥匙尚未使用");
assert.equal(novelPayload.continuity_context.chapterId, "chapter-1");

await context.fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    mode: "companion",
    messages: [{ role: "user", content: "你好" }],
    creative_context: { should: "not leave browser" },
    memory_context: { should: "not leave browser" },
    continuity_context: { should: "not leave browser" }
  })
});

const companionPayload = JSON.parse(nativeRequests.at(-1).init.body);
assert.equal(companionPayload.mode, "companion");
assert.equal("creative_context" in companionPayload, false);
assert.equal("memory_context" in companionPayload, false);
assert.equal("continuity_context" in companionPayload, false);

console.log("V16.3 chat context VM contract passed: one fetch entry, three registered novel context providers, strict companion isolation.");