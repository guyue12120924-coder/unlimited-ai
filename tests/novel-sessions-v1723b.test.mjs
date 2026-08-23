import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const js = fs.readFileSync("public/novel-sessions-v1723b.js", "utf8");
const css = fs.readFileSync("public/novel-sessions-v1723b.css", "utf8");
const readme = fs.readFileSync("README.md", "utf8");

assert.match(index, /unlimited-novel-revision" content="2026-08-23-v17\.23c-novel-navigation"/);
assert.match(index, /novel-sessions-v1723b\.css\?v=20260823-v17\.23b-novel-session-management/);
assert.match(index, /novel-sessions-v1723b\.js\?v=20260823-v17\.23b-novel-session-management/);
assert.ok(index.indexOf("/novel-sessions-v1723b.css") < index.indexOf("/companion-core-polish-v176.css"));
assert.ok(index.indexOf("/novel-sessions-v1723b.js") < index.indexOf("/companion-function-pack-v177.js"));

assert.match(js, /dataset\?\.uaiMode === "novel"/);
assert.match(js, /novelV1723SessionDialog/);
assert.match(js, /重命名会话/);
assert.match(js, /删除这个对话？/);
assert.match(js, /document\.getElementById\("newSessionBtn"\)\?\.click\(\)/);
assert.match(js, /invokeCoreButton\(button, "confirm", true\)/);
assert.match(js, /invokeCoreButton\(button, "prompt", value\)/);
assert.match(js, /stopImmediatePropagation\(\)/);
assert.match(js, /meta\.textContent !== nextMeta/);
assert.match(js, /rename\.textContent !== "重命名"/);
assert.doesNotMatch(js, /UnlimitedCompanion|uai_companion_|uaiCompanionRoot/);

assert.match(css, /V17\.23B Novel Session Management/);
assert.match(css, /body\[data-uai-mode="novel"\]/);
assert.match(css, /\.delete-session:hover/);
assert.match(css, /\.novel-v1723-session-dialog/);
assert.doesNotMatch(css, /#uaiCompanionRoot|data-uai-mode="companion"|\.uai-c-/);

assert.match(readme, /## 10\. 小说模式 V17\.23 修改路线/);
assert.match(readme, /V17\.23A — 浅色视觉体系 \+ 页面减法 ✅ 已完成/);
assert.match(readme, /V17\.23B — 会话管理 \+ 明确删除 ✅ 已完成/);
assert.match(readme, /V17\.23C — 作品 \/ 章节 \/ 创作资料导航 ✅ 已完成/);
assert.match(readme, /V17\.23D — 输入区、顶部栏和最终 UX 收口 ⏳ 下一阶段/);

console.log("V17.23B novel session management contract remains intact under V17.23C.");
