import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const boot = read("public/boot-diagnostics.js");
const router = read("public/mode-router.js");
const companionClient = read("public/companion-mode.js");
const companionCss = read("public/companion-mode.css");
const companionPolish = read("public/companion-v2.js");
const companionPolishCss = read("public/companion-v2.css");
const companionMulti = read("public/companion-v3.js");
const companionMultiCss = read("public/companion-v3.css");
const companionGuard = read("public/companion-v3-guard.js");
const companionMemorySearch = read("public/companion-v4.js");
const companionMemorySearchCss = read("public/companion-v4.css");
const companionProfileRestore = read("public/companion-v5.js");
const companionProfileRestoreCss = read("public/companion-v5.css");
const companionReviewExport = read("public/companion-v6.js");
const companionReviewExportCss = read("public/companion-v6.css");
const worker = read("src/worker.js");
const companionSource = read("src/companion.js");

assert.match(boot, /2026-08-13-v6\.0-dual-mode-1/);
for (const asset of ["mode-router.js", "companion-v2.js", "companion-v2.css", "companion-v3.js", "companion-v3.css", "companion-v3-guard.js", "companion-v4.js", "companion-v4.css", "companion-v5.js", "companion-v5.css", "companion-v5-guard.js", "companion-v6.js", "companion-v6.css"]) assert.match(boot, new RegExp(asset.replace(".", "\\.")));
for (const marker of ["companionPolishReady", "companionMultiReady", "companionGuardReady", "companionMemorySearchReady", "companionProfileRestoreReady", "companionRestoreGuardReady", "companionReviewExportReady", "uai-mode-gate-pending"]) assert.match(boot, new RegExp(marker));

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
assert.doesNotMatch(companionClient, /cfw_sessions_v2|creative_context|continuity_context|storyMemory/);

assert.match(companionPolish, /uai_companion_meta_v2/);
assert.match(companionPolish, /function relationshipStage\(/);
assert.match(companionPolish, /uaiCompanionQuickBar/);
assert.match(companionPolish, /uaiCompanionReturnCard/);
assert.match(companionPolish, /function pinMemory\(/);
assert.match(companionPolish, /uaiCompanionScrollBottom/);
assert.match(companionPolish, /UnlimitedCompanionPolish/);
assert.doesNotMatch(companionPolish, /cfw_sessions_v2|creative_context|continuity_context|storyMemory/);

assert.match(companionMulti, /uai_companion_characters_v1/);
assert.match(companionMulti, /uai_companion_active_character_v1/);
assert.match(companionMulti, /MAX_CHARACTERS = 6/);
assert.match(companionMulti, /function persistActiveCharacter\(/);
assert.match(companionMulti, /function loadCharacterIntoSlots\(/);
assert.match(companionMulti, /function switchCharacter\(/);
assert.match(companionMulti, /function showCharacterManager\(/);
assert.match(companionMulti, /function editAndResend\(/);
assert.match(companionMulti, /function regenerateAssistant\(/);
assert.match(companionMulti, /function extractStructuredMemories\(/);
assert.match(companionMulti, /v3GreetingEnhanced/);
assert.match(companionMulti, /UnlimitedCompanionMulti/);
assert.doesNotMatch(companionMulti, /cfw_sessions_v2|creative_context|continuity_context|storyMemory/);

assert.match(companionGuard, /function blockUnsafeActions\(/);
assert.match(companionGuard, /#uaiCompanionInput:disabled/);
assert.match(companionGuard, /unlimited-ai-companion-multichar-backup/);
assert.match(companionGuard, /function exportAllCharacters\(/);
assert.match(companionGuard, /function reconcileReset\(/);
assert.match(companionGuard, /UnlimitedCompanionGuard/);
assert.doesNotMatch(companionGuard, /cfw_sessions_v2|creative_context|continuity_context|storyMemory/);

assert.match(companionMemorySearch, /uai_companion_moments_v1/);
assert.match(companionMemorySearch, /uai_companion_memory_archive_v1/);
assert.match(companionMemorySearch, /function showMemoryOrganizer\(/);
assert.match(companionMemorySearch, /function dedupeMemories\(/);
assert.match(companionMemorySearch, /function archiveAllStale\(/);
assert.match(companionMemorySearch, /function showSearch\(/);
assert.match(companionMemorySearch, /function searchSessions\(/);
assert.match(companionMemorySearch, /function showMoments\(/);
assert.match(companionMemorySearch, /data-v4-moment/);
assert.match(companionMemorySearch, /uaiCompanionV4Context/);
assert.match(companionMemorySearch, /UnlimitedCompanionMemorySearch/);
assert.doesNotMatch(companionMemorySearch, /cfw_sessions_v2|creative_context|continuity_context|storyMemory/);

assert.match(companionProfileRestore, /uai_companion_import_rollback_v1/);
assert.match(companionProfileRestore, /MAX_CHARACTERS = 6/);
assert.match(companionProfileRestore, /function showCharacterProfile\(/);
assert.match(companionProfileRestore, /function buildTimeline\(/);
assert.match(companionProfileRestore, /重要时刻纪念册/);
assert.match(companionProfileRestore, /const TEMPLATES = \[/);
assert.match(companionProfileRestore, /function showTemplates\(/);
assert.match(companionProfileRestore, /function validateBackup\(/);
assert.match(companionProfileRestore, /unlimited-ai-companion-multichar-backup/);
assert.match(companionProfileRestore, /\[1, 2\]\.includes\(Number\(raw\.version\)\)/);
assert.match(companionProfileRestore, /function sanitizeMessage\(/);
assert.match(companionProfileRestore, /function sanitizeCharacter\(/);
assert.match(companionProfileRestore, /function applyImportedBackup\(/);
assert.match(companionProfileRestore, /mode === "replace"/);
assert.match(companionProfileRestore, /合并导入/);
assert.match(companionProfileRestore, /覆盖恢复/);
assert.match(companionProfileRestore, /function saveRollback\(/);
assert.match(companionProfileRestore, /function restoreRollback\(/);
assert.match(companionProfileRestore, /UnlimitedCompanionProfileRestore/);
assert.doesNotMatch(companionProfileRestore, /cfw_sessions_v2|creative_context|continuity_context|storyMemory/);

assert.match(companionReviewExport, /uai_companion_characters_v1/);
assert.match(companionReviewExport, /function monthlyReview\(/);
assert.match(companionReviewExport, /function reachedMilestones\(/);
assert.match(companionReviewExport, /认识一周/);
assert.match(companionReviewExport, /1000 条消息/);
assert.match(companionReviewExport, /认识一年/);
assert.match(companionReviewExport, /function showMonthlyReview\(/);
assert.match(companionReviewExport, /function ensureQuickSwitch\(/);
assert.match(companionReviewExport, /#uaiCompanionInput:disabled/);
assert.match(companionReviewExport, /function buildReadableMarkdown\(/);
assert.match(companionReviewExport, /完整聊天记录/);
assert.match(companionReviewExport, /text\/markdown/);
assert.match(companionReviewExport, /UnlimitedCompanionReviewExport/);
assert.doesNotMatch(companionReviewExport, /cfw_sessions_v2|creative_context|continuity_context|storyMemory/);

assert.match(companionCss, /#uaiCompanionRoot/);
assert.match(companionCss, /@media \(max-width: 780px\)/);
assert.match(companionCss, /100dvh/);
for (const marker of ["uai-c-v2-stage", "uai-c-v2-quickbar", "uai-c-v2-return-card", "uai-c-v2-message-actions", "uai-c-v2-scroll-bottom"]) assert.match(companionPolishCss, new RegExp(marker));
for (const marker of ["uai-c-v3-character-bar", "uai-c-v3-character-card", "uai-c-v3-actions"]) assert.match(companionMultiCss, new RegExp(marker));
assert.match(companionMultiCss, /@media \(max-width: 780px\)/);
for (const marker of ["uai-c-v4-context", "uai-c-v4-memory", "uai-c-v4-search-result", "uai-c-v4-moment", "uai-c-v4-roster-summary"]) assert.match(companionMemorySearchCss, new RegExp(marker));
assert.match(companionMemorySearchCss, /@media \(max-width: 780px\)/);
for (const marker of ["uai-c-v5-profile-hero", "uai-c-v5-timeline", "uai-c-v5-album", "uai-c-v5-template-grid", "uai-c-v5-import-summary"]) assert.match(companionProfileRestoreCss, new RegExp(marker));
assert.match(companionProfileRestoreCss, /@media \(max-width:780px\)/);
for (const marker of ["uai-c-v6-quick-switch", "uai-c-v6-review-card", "uai-c-v6-review-grid", "uai-c-v6-topic-list", "uai-c-v6-milestones"]) assert.match(companionReviewExportCss, new RegExp(marker));
assert.match(companionReviewExportCss, /@media \(max-width:780px\)/);

assert.match(worker, /payload\?\.mode === "companion" \? "companion" : "novel"/);
assert.match(worker, /buildCompanionSystemPrompt\(payload\)/);
assert.match(worker, /buildCreativeContextMessage/);
assert.match(worker, /mode === "companion"/);
assert.match(worker, /Important isolation boundary/);

assert.doesNotMatch(companionSource, /\.\/context\.js|memory-extractor|continuity-review/);
assert.match(companionSource, /用户可控长期记忆/);
assert.match(companionSource, /记忆使用原则/);
assert.match(companionSource, /不要用内疚、威胁、排他/);
assert.match(companionSource, /getCompanionFamiliarityStage/);
assert.match(companionSource, /normalizeCompanionMemory/);
assert.match(companionSource, /置顶记忆和稳定事实会优先进入上下文/);

const moduleUrl = process.env.COMPANION_MODULE;
assert.ok(moduleUrl, "COMPANION_MODULE must point to the copied companion module");
const { buildCompanionSystemPrompt, getCompanionFamiliarityStage, normalizeCompanionMemory } = await import(moduleUrl);
assert.equal(getCompanionFamiliarityStage({ daysKnown: 1, messageCount: 6, sessionCount: 1 }).key, "new");
assert.equal(getCompanionFamiliarityStage({ daysKnown: 2, messageCount: 30, sessionCount: 2 }).key, "familiar");
assert.equal(getCompanionFamiliarityStage({ daysKnown: 4, messageCount: 90, sessionCount: 5 }).key, "close");
assert.equal(getCompanionFamiliarityStage({ daysKnown: 10, messageCount: 220, sessionCount: 10 }).key, "in-sync");

const rankedMemory = normalizeCompanionMemory([
  { text: "用户最近正在整理桌面", kind: "current", createdAt: Date.now() },
  { text: "用户喜欢喝拿铁", kind: "like", createdAt: Date.now() - 30 * 86400000 },
  { text: "用户希望记住：下次先问论文进度", source: "pinned-v4", kind: "explicit", createdAt: Date.now() - 100 * 86400000 },
  { text: "用户的生日是 8 月 18 日", kind: "birthday", createdAt: Date.now() - 200 * 86400000 }
]);
assert.equal(rankedMemory[0], "用户希望记住：下次先问论文进度");
assert.ok(rankedMemory.indexOf("用户的生日是 8 月 18 日") < rankedMemory.indexOf("用户最近正在整理桌面"));

const prompt = buildCompanionSystemPrompt({
  character: { name: "小雨", relationship: "girlfriend", personality: ["温柔", "傲娇"], customDescription: "说话自然一点" },
  companion_memory: [{ text: "用户喜欢喝拿铁" }, { text: "用户最近在准备保研" }],
  relationship_context: { daysKnown: 3, messageCount: 28, sessionCount: 2, recentTopics: ["论文修改"] },
  companion_preferences: { replyLength: "short" },
  local_context: { currentTime: "2026/8/13 18:15:00" }
});
assert.match(prompt, /小雨|女朋友|温柔、傲娇|用户喜欢喝拿铁|用户最近在准备保研|论文修改|越来越熟|1～3 句话|不要一次罗列多条记忆|不要把每一轮都写成/);
assert.doesNotMatch(prompt, /当前正文|未解决伏笔/);

console.log("Companion V6 contract passed: isolated companion -> memory/search/moments -> profile/restore -> quick switch/monthly milestones/readable export -> novel isolation.");
