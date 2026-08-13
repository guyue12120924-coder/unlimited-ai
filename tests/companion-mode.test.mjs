import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const boot = read("public/boot-diagnostics.js");
const router = read("public/mode-router.js");
const companionClient = read("public/companion-mode.js");
const companionCss = read("public/companion-mode.css");
const worker = read("src/worker.js");
const companionSource = read("src/companion.js");

assert.match(boot, /2026-08-13-v4\.0-dual-mode-1/);
assert.match(boot, /mode-router\.js/);
assert.match(boot, /uai-mode-gate-pending/);

assert.match(router, /uaiEnterNovel/);
assert.match(router, /uaiEnterCompanion/);
assert.match(router, /function showLobby\(/);
assert.match(router, /function enterNovel\(/);
assert.match(router, /function enterCompanion\(/);
assert.match(router, /UnlimitedCompanion\.mount/);
assert.match(router, /每次打开 Unlimited AI 都会先回到这里/);

assert.match(companionClient, /uai_companion_profile_v1/);
assert.match(companionClient, /uai_companion_sessions_v1/);
assert.match(companionClient, /uai_companion_memories_v1/);
assert.match(companionClient, /uai_companion_settings_v1/);
assert.match(companionClient, /mode: "companion"/);
assert.match(companionClient, /companion_memory/);
assert.match(companionClient, /relationship_context/);
assert.match(companionClient, /extractHighConfidenceMemories/);
assert.match(companionClient, /consumeSse/);
assert.match(companionClient, /unlimited-ai-companion-backup/);
assert.doesNotMatch(companionClient, /cfw_sessions_v2/);
assert.doesNotMatch(companionClient, /creative_context/);
assert.doesNotMatch(companionClient, /continuity_context/);
assert.doesNotMatch(companionClient, /storyMemory/);

assert.match(companionCss, /#uaiCompanionRoot/);
assert.match(companionCss, /@media \(max-width: 780px\)/);
assert.match(companionCss, /100dvh/);

assert.match(worker, /payload\?\.mode === "companion" \? "companion" : "novel"/);
assert.match(worker, /buildCompanionSystemPrompt\(payload\)/);
assert.match(worker, /buildCreativeContextMessage/);
assert.match(worker, /mode === "companion"/);
assert.match(worker, /Important isolation boundary/);

assert.doesNotMatch(companionSource, /\.\/context\.js/);
assert.doesNotMatch(companionSource, /memory-extractor/);
assert.doesNotMatch(companionSource, /continuity-review/);
assert.match(companionSource, /用户可控长期记忆/);
assert.match(companionSource, /不要用内疚、威胁、排他/);

const moduleUrl = process.env.COMPANION_MODULE;
assert.ok(moduleUrl, "COMPANION_MODULE must point to the copied companion module");
const { buildCompanionSystemPrompt } = await import(moduleUrl);
const prompt = buildCompanionSystemPrompt({
  character: {
    name: "小雨",
    relationship: "girlfriend",
    personality: ["温柔", "傲娇"],
    customDescription: "说话自然一点"
  },
  companion_memory: [
    { text: "用户喜欢喝拿铁" },
    { text: "用户最近在准备保研" }
  ],
  relationship_context: {
    daysKnown: 3,
    messageCount: 18,
    sessionCount: 2,
    recentTopics: ["论文修改"]
  },
  companion_preferences: { replyLength: "short" },
  local_context: { currentTime: "2026/8/13 18:15:00" }
});

assert.match(prompt, /小雨/);
assert.match(prompt, /女朋友/);
assert.match(prompt, /温柔、傲娇/);
assert.match(prompt, /用户喜欢喝拿铁/);
assert.match(prompt, /用户最近在准备保研/);
assert.match(prompt, /论文修改/);
assert.match(prompt, /1～3 句话/);
assert.doesNotMatch(prompt, /当前正文/);
assert.doesNotMatch(prompt, /未解决伏笔/);

console.log("Companion contract passed: lobby -> isolated client storage -> mode-routed worker -> companion-only prompt context.");
