import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const moduleUrl = process.env.CONTEXT_MODULE || pathToFileURL("/tmp/context-under-test.mjs").href;
const { buildCreativeContextMessage } = await import(moduleUrl);

const context = {
  project: {
    name: "连续性测试小说",
    description: "悬疑长篇",
    synopsis: "林雪与顾辰追查失踪案。",
    outline: "最终需要揭开旧医院的真相。",
    worldOverview: "现代城市。",
    worldRules: "林雪明确不能饮酒；已经发生的身体伤势不能无故消失。",
    locations: "旧医院、警局",
    relations: "林雪 -> 顾辰：暂时不信任",
    timeline: "周一夜：医院事件",
    foreshadow: "人工记录：地下室门锁异常"
  },
  chapter: {
    name: "第三章",
    summary: "林雪进入旧医院。",
    notes: "本章保持压迫感，不要让林雪突然信任顾辰。",
    targetWords: 3000,
    manuscriptExcerpt: "林雪用没有受伤的右手握紧手电，左手仍缠着绷带。顾辰站在三步之外，她没有让他靠近。"
  },
  previousChapterSummary: "上一章林雪左手受伤。",
  characters: [
    {
      name: "林雪",
      role: "刑警",
      personality: "冷静、戒备心强",
      currentState: "健康，无伤",
      voice: "说话简短，很少解释"
    }
  ]
};

const continuity = {
  previousChapterSummary: "上一章林雪左手被玻璃划伤，并开始怀疑顾辰。",
  characterStates: [
    { name: "林雪", state: "左手受伤并包扎；对顾辰保持怀疑；当前在旧医院。" }
  ],
  openThreads: [
    {
      id: "thread-key",
      type: "object",
      title: "黑色钥匙",
      detail: "黑色钥匙仍在林雪口袋里，尚未找到对应的门。",
      status: "open"
    }
  ]
};

const output = buildCreativeContextMessage(context, null, continuity);

assert.ok(output.includes("当前章节正文末尾（最高优先级）"), "missing manuscript priority section");
assert.ok(output.includes("左手仍缠着绷带"), "formal manuscript tail was not injected");
assert.ok(output.includes("当前状态：左手受伤并包扎"), "reviewed character state was not injected");
assert.ok(!output.includes("当前状态：健康，无伤"), "stale character state overrode reviewed state");
assert.ok(output.includes("黑色钥匙仍在林雪口袋里"), "open plot thread was not injected");
assert.ok(output.includes("林雪明确不能饮酒"), "world rule was not injected");

const orderedSections = [
  "## 当前章节正文末尾（最高优先级）",
  "## 当前章节计划与状态",
  "## 当前相关人物（高优先级）",
  "## 人物关系",
  "## 尚未解决的伏笔与持续事件",
  "## 世界观与硬性规则",
  "## 上一章摘要",
  "## 总体大纲"
];

let previousIndex = -1;
for (const heading of orderedSections) {
  const index = output.indexOf(heading);
  assert.ok(index >= 0, `missing context section: ${heading}`);
  assert.ok(index > previousIndex, `wrong priority order near: ${heading}`);
  previousIndex = index;
}

const largeContext = structuredClone(context);
largeContext.project.outline = "低优先级总纲".repeat(5000);
const largeOutput = buildCreativeContextMessage(largeContext, null, continuity);
assert.ok(largeOutput.includes("左手仍缠着绷带"), "large outline displaced current manuscript context");
assert.ok(largeOutput.includes("黑色钥匙仍在林雪口袋里"), "large outline displaced unresolved continuity thread");

console.log("Context quality contract passed.");
