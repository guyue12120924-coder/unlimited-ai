import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const transportSource = fs.readFileSync("public/chat-transport-v16.js", "utf8");
const contextCoreSource = fs.readFileSync("public/chat-context-core-v163.js", "utf8");

const nativeRequests = [];
const nativeFetch = async (input, init = {}) => {
  nativeRequests.push({ input, init });
  return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
};

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
  fetch: nativeFetch,
  Response,
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
assert.equal(context.UnlimitedChatTransportV16.registryRevision, "2026-08-21-v16.4-chat-registry");

// The canonical creative-context builder now lives in context-bridge.js; the context
// core only registers it instead of maintaining a second copy of that algorithm.
context.UnlimitedContext = {
  buildContext(payload) {
    if (payload.mode !== "novel") return null;
    return {
      version: 1,
      project: { name: "测试小说", synopsis: "一段简介" },
      chapter: { id: "chapter-1", title: "第一章" },
      characters: [
        { name: "林雨桐", personality: "冷静" },
        { name: "顾辰", personality: "谨慎" }
      ]
    };
  }
};
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

// Simulate a stale wrapper left by an older deployment. V16.4 must restore the one
// stable transport entry after registering the three providers.
context.fetch = async (...args) => stableFetch(...args);
vm.runInContext(contextCoreSource, context, { filename: "chat-context-core-v163.js" });

assert.equal(context.UnlimitedChatContextV163.installed, true);
assert.equal(context.fetch, stableFetch, "V16.4 must restore one fetch entry");
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

console.log("V16.4 chat context VM contract passed: canonical creative builder, one fetch entry, three novel providers, strict companion isolation.");
