import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync("src/worker.js", "utf8");
const companion = fs.readFileSync("src/companion.js", "utf8");
const client = fs.readFileSync("public/companion-mode.js", "utf8");

for (const key of [
  "uai_companion_profile_v1",
  "uai_companion_sessions_v1",
  "uai_companion_memories_v1",
  "uai_companion_settings_v1"
]) assert.match(client, new RegExp(key));

assert.match(client, /mode: "companion"/);
assert.match(client, /companion_memory/);
assert.match(client, /relationship_context/);
assert.doesNotMatch(client, /cfw_sessions_v2|creative_context|continuity_context|storyMemory/);

assert.match(companion, /COMPANION_ROLE_CARD/);
assert.match(companion, /getCompanionRoleCard/);
assert.match(companion, /buildCompanionRuntimeContext/);
assert.match(companion, /normalizeCompanionMemory/);
assert.match(companion, /getCompanionFamiliarityStage/);
assert.doesNotMatch(companion, /\.\/context\.js|memory-extractor|continuity-review/);

assert.match(worker, /getCompanionRoleCard\(\)/);
assert.match(worker, /buildCompanionRuntimeContext\(payload\)/);
assert.match(worker, /role: "system",\s*content: roleCard/s);
assert.match(worker, /role: "user",\s*content: runtimeContext/s);
assert.match(worker, /Important isolation boundary/);
assert.match(worker, /buildCreativeContextMessage/);

const moduleUrl = process.env.COMPANION_MODULE;
assert.ok(moduleUrl);
const {
  getCompanionRoleCard,
  buildCompanionRuntimeContext,
  getCompanionFamiliarityStage,
  normalizeCompanionMemory
} = await import(moduleUrl);

const card = getCompanionRoleCard();
assert.ok(card.length > 20);

const context = buildCompanionRuntimeContext({
  character: { name: "小雨", relationship: "girlfriend", personality: ["温柔", "傲娇"] },
  companion_memory: [{ text: "用户喜欢喝拿铁" }],
  relationship_context: { daysKnown: 3, messageCount: 28, sessionCount: 2, recentTopics: ["论文修改"] },
  companion_preferences: { replyLength: "short" },
  local_context: { currentTime: "2026/8/13 18:15:00" }
});

assert.match(context, /小雨|女朋友|温柔、傲娇|用户喜欢喝拿铁|论文修改|越来越熟|1～3 句话/);
assert.doesNotMatch(card, /用户喜欢喝拿铁|论文修改|2026\/8\/13/);

assert.equal(getCompanionFamiliarityStage({ daysKnown: 1, messageCount: 6, sessionCount: 1 }).key, "new");
assert.equal(getCompanionFamiliarityStage({ daysKnown: 4, messageCount: 90, sessionCount: 5 }).key, "close");

const ranked = normalizeCompanionMemory([
  { text: "用户最近正在整理桌面", kind: "current", createdAt: Date.now() },
  { text: "用户希望记住：下次先问论文进度", source: "pinned-v4", kind: "explicit", createdAt: Date.now() - 86400000 }
]);
assert.equal(ranked[0], "用户希望记住：下次先问论文进度");

console.log("Companion mode contract passed.");
