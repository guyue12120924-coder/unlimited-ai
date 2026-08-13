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
const worker = read("src/worker.js");
const companionSource = read("src/companion.js");

assert.match(boot, /2026-08-13-v5\.0-dual-mode-1/);
assert.match(boot, /mode-router\.js/);
assert.match(boot, /companion-v2\.js/);
assert.match(boot, /companion-v2\.css/);
assert.match(boot, /companion-v3\.js/);
assert.match(boot, /companion-v3\.css/);
assert.match(boot, /companion-v3-guard\.js/);
assert.match(boot, /companion-v4\.js/);
assert.match(boot, /companion-v4\.css/);
assert.match(boot, /companion-v5\.js/);
assert.match(boot, /companion-v5\.css/);
assert.match(boot, /companionPolishReady/);
assert.match(boot, /companionMultiReady/);
assert.match(boot, /companionGuardReady/);
assert.match(boot, /companionMemorySearchReady/);
assert.match(boot, /companionProfileRestoreReady/);
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

assert.match(companionPolish, /uai_companion_meta_v2/);
assert.match(companionPolish, /function relationshipStage\(/);
assert.match(companionPolish, /uaiCompanionQuickBar/);
assert.match(companionPolish, /uaiCompanionReturnCard/);
assert.match(companionPolish, /function pinMemory\(/);
assert.match(companionPolish, /uaiCompanionScrollBottom/);
assert.match(companionPolish, /UnlimitedCompanionPolish/);
assert.doesNotMatch(companionPolish, /cfw_sessions_v2/);
assert.doesNotMatch(companionPolish, /creative_context/);
assert.doesNotMatch(companionPolish, /continuity_context/);
assert.doesNotMatch(companionPolish, /storyMemory/);

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
assert.doesNotMatch(companionMulti, /cfw_sessions_v2/);
assert.doesNotMatch(companionMulti, /creative_context/);
assert.doesNotMatch(companionMulti, /continuity_context/);
assert.doesNotMatch(companionMulti, /storyMemory/);

assert.match(companionGuard, /function blockUnsafeActions\(/);
assert.match(companionGuard, /#uaiCompanionInput:disabled/);
assert.match(companionGuard, /unlimited-ai-companion-multichar-backup/);
assert.match(companionGuard, /function exportAllCharacters\(/);
assert.match(companionGuard, /function reconcileReset\(/);
assert.match(companionGuard, /UnlimitedCompanionGuard/);
assert.doesNotMatch(companionGuard, /cfw_sessions_v2/);
assert.doesNotMatch(companionGuard, /creative_context/);
assert.doesNotMatch(companionGuard, /continuity_context/);
assert.doesNotMatch(companionGuard, /storyMemory/);

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
assert.doesNotMatch(companionMemorySearch, /cfw_sessions_v2/);
assert.doesNotMatch(companionMemorySearch, /creative_context/);
assert.doesNotMatch(companionMemorySearch, /continuity_context/);
assert.doesNotMatch(companionMemorySearch, /storyMemory/);

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
assert.doesNotMatch(companionProfileRestore, /cfw_sessions_v2/);
assert.doesNotMatch(companionProfileRestore, /creative_context/);
assert.doesNotMatch(companionProfileRestore, /continuity_context/);
assert.doesNotMatch(companionProfileRestore, /storyMemory/);

assert.match(companionCss, /#uaiCompanionRoot/);
assert.match(companionCss, /@media \(max-width: 780px\)/);
assert.match(companionCss, /100dvh/);
assert.match(companionPolishCss, /uai-c-v2-stage/);
assert.match(companionPolishCss, /uai-c-v2-quickbar/);
assert.match(companionPolishCss, /uai-c-v2-return-card/);
assert.match(companionPolishCss, /uai-c-v2-message-actions/);
assert.match(companionPolishCss, /uai-c-v2-scroll-bottom/);
assert.match(companionMultiCss, /uai-c-v3-character-bar/);
assert.match(companionMultiCss, /uai-c-v3-character-card/);
assert.match(companionMultiCss, /uai-c-v3-actions/);
assert.match(companionMultiCss, /@media \(max-width: 780px\)/);
assert.match(companionMemorySearchCss, /uai-c-v4-context/);
assert.match(companionMemorySearchCss, /uai-c-v4-memory/);
assert.match(companionMemorySearchCss, /uai-c-v4-search-result/);
assert.match(companionMemorySearchCss, /uai-c-v4-moment/);
assert.match(companionMemorySearchCss, /uai-c-v4-roster-summary/);
assert.match(companionMemorySearchCss, /@media \(max-width: 780px\)/);
assert.match(companionProfileRestoreCss, /uai-c-v5-profile-hero/);
assert.match(companionProfileRestoreCss, /uai-c-v5-timeline/);
assert.match(companionProfileRestoreCss, /uai-c-v5-album/);
assert.match(companionProfileRestoreCss, /uai-c-v5-template-grid/);
assert.match(companionProfileRestoreCss, /uai-c-v5-import-summary/);
assert.match(companionProfileRestoreCss, /@media \(max-width:780px\)/);

assert.match(worker, /payload\?\.mode === "companion" \? "companion" : "novel"/);
assert.match(worker, /buildCompanionSystemPrompt\(payload\)/);
assert.match(worker, /buildCreativeContextMessage/);
assert.match(worker, /mode === "companion"/);
assert.match(worker, /Important isolation boundary/);

assert.doesNotMatch(companionSource, /\.\/context\.js/);
assert.doesNotMatch(companionSource, /memory-extractor/);
assert.doesNotMatch(companionSource, /continuity-review/);
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

assert.match(prompt, /小雨/);
assert.match(prompt, /女朋友/);
assert.match(prompt, /温柔、傲娇/);
assert.match(prompt, /用户喜欢喝拿铁/);
assert.match(prompt, /用户最近在准备保研/);
assert.match(prompt, /论文修改/);
assert.match(prompt, /越来越熟/);
assert.match(prompt, /1～3 句话/);
assert.match(prompt, /不要一次罗列多条记忆/);
assert.match(prompt, /不要把每一轮都写成/);
assert.doesNotMatch(prompt, /当前正文/);
assert.doesNotMatch(prompt, /未解决伏笔/);

console.log("Companion V5 contract passed: isolated companion -> memory/search/moments -> profile timeline/templates -> validated backup restore -> novel isolation.");
