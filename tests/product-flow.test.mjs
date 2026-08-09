import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const index = read("public/index.html");
const runtime = read("public/v3-runtime.js");
const sidebar = read("public/v3-sidebar.js");
const experience = read("public/v2-experience.js");
const userFlow = read("public/user-flow.js");
const aiToManuscript = read("public/ai-to-manuscript.js");
const phase1 = read("public/v2-product.js");
const phase2 = read("public/v2-product-phase2.js");
const phase3 = read("public/v2-product-phase3.js");

const runtimeIndex = index.indexOf("/v3-runtime.js");
const sidebarIndex = index.indexOf("/v3-sidebar.js");
const order = [
  "/user-flow.js",
  "/ai-to-manuscript.js",
  "/v2-experience.js",
  "/v2-product.js",
  "/v2-product-phase2.js",
  "/v2-product-phase3.js"
].map((item) => index.indexOf(item));

assert(runtimeIndex >= 0, "V3 runtime must be loaded");
assert(sidebarIndex > runtimeIndex, "stable sidebar must load after V3 runtime");
assert(order.every((value) => value >= 0), "all product experience scripts must be loaded");
assert(order.every((value, position) => position === 0 || value > order[position - 1]), "product experience scripts must load in order");
assert(order.every((value) => value > sidebarIndex), "stable sidebar must load before every product experience adapter");
assert.match(index, /v3-product\.css/);
assert.match(index, /v3\.0-static-label-lock-1/);
assert.match(index, /<span>AI 小说创作<\/span>/, "initial brand subtitle must already match the final V3 copy");
assert.match(index, /v3-sidebar\.js\?v=20260809-2/, "static label fix must use a fresh browser cache key");
assert.doesNotMatch(index, /removeAttribute\("data-v2-outline-ready"\)/, "temporary outline inline patch must live in V3 runtime, not index.html");

assert.match(runtime, /CoordinatedMutationObserver/);
assert.match(runtime, /requestAnimationFrame\(flushObservers\)/);
assert.match(runtime, /window\.MutationObserver = CoordinatedMutationObserver/);
assert.match(runtime, /function refreshAll\(/);
assert.match(runtime, /UnlimitedV3/);
assert.match(runtime, /runtimeDiagnostics/);
assert.match(runtime, /data-unlimited-runtime|dataset\.unlimitedRuntime/);

assert.match(sidebar, /__UNLIMITED_NATIVE_MUTATION_OBSERVER__/);
assert.match(sidebar, /STATIC_LABELS/);
assert.match(sidebar, /AI 小说创作/);
assert.match(sidebar, /WRITING/);
assert.match(sidebar, /STORY/);
assert.match(sidebar, /ensureVisualLockStyle/);
assert.match(sidebar, /font-size: 0 !important/);
assert.match(sidebar, /function patchStaticLabels\(/);
assert.match(sidebar, /function patchChapterList\(/);
assert.match(sidebar, /function patchSessionList\(/);
assert.match(sidebar, /setTextIfChanged/);
assert.match(sidebar, /字 · \$\{done \? "已完成" : "写作中"\}/);
assert.match(sidebar, /same microtask checkpoint/);
assert.match(sidebar, /Cosmetic copy must never alternate/);
assert.match(sidebar, /UnlimitedV3Sidebar/);

assert.match(experience, /isPristineProject/);
assert.match(experience, /createFirstChapter/);
assert.match(experience, /Existing work is never rewritten/);

assert.match(aiToManuscript, /加入正文/);
assert.match(userFlow, /nextChapterAction/);
assert.match(userFlow, /workflowCompleteChapter/);

assert.match(phase1, /data-v2-edit="polish"/);
assert.match(phase1, /替换原文/);
assert.match(phase1, /插入原文后/);

assert.match(phase2, /删除章节前/);
assert.match(phase2, /v210MobileNav/);
assert.match(phase2, /对话<\/button><button type="button" data-v210-view="draft">正文/);

assert.match(phase3, /BACKUP_FORMAT = "unlimited-ai-backup"/);
assert.match(phase3, /exportCompleteBackup/);
assert.match(phase3, /restoreLocalData/);
assert.match(phase3, /恢复前/);
assert.match(phase3, /dataHealth/);

assert.match(phase3, /v213DraftEmpty/);
assert.match(phase3, /还没有人物/);
assert.match(phase3, /还没有大纲/);
assert.match(phase3, /还没有设定/);

assert.match(phase3, /v211-long-workspace/);
assert.match(phase3, /LONG_CHAT_ROWS = 80/);
assert.match(phase3, /LONG_BOOK_CHARS = 120000/);

assert.match(phase3, /runDiagnostics/);
assert.match(phase3, /产品自检/);

console.log("V3 product contract passed: coordinated runtime -> locked labels/sidebar -> first run -> AI -> manuscript -> chapter completion -> mobile/data safety.");
