import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const index = read("public/index.html");
const experience = read("public/v2-experience.js");
const userFlow = read("public/user-flow.js");
const aiToManuscript = read("public/ai-to-manuscript.js");
const phase1 = read("public/v2-product.js");
const phase2 = read("public/v2-product-phase2.js");
const phase3 = read("public/v2-product-phase3.js");

const order = [
  "/v2-experience.js",
  "/v2-product.js",
  "/v2-product-phase2.js",
  "/v2-product-phase3.js"
].map((item) => index.indexOf(item));

assert(order.every((value) => value >= 0), "all product experience scripts must be loaded");
assert(order.every((value, index) => index === 0 || value > order[index - 1]), "product experience scripts must load in order");

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

console.log("Product flow contract passed: first run -> AI -> manuscript -> chapter completion -> mobile/data safety.");
