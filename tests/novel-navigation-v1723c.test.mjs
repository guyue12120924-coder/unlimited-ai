import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const js = fs.readFileSync("public/novel-navigation-v1723c.js", "utf8");
const css = fs.readFileSync("public/novel-navigation-v1723c.css", "utf8");
const simplifyJs = fs.readFileSync("public/novel-simplify-v1723.js", "utf8");
const finalJs = fs.readFileSync("public/novel-final-v1723d.js", "utf8");
const finalCss = fs.readFileSync("public/novel-final-v1723d.css", "utf8");
const deployStatus = fs.readFileSync("public/deploy-status.json", "utf8");
const readme = fs.readFileSync("README.md", "utf8");

assert.match(index, /unlimited-novel-revision" content="2026-08-23-v17\.23d-novel-final-ux"/);
assert.match(index, /novel-navigation-v1723c\.css\?v=20260823-v17\.23c-novel-navigation/);
assert.match(index, /novel-navigation-v1723c\.js\?v=20260823-v17\.23c-novel-navigation/);
assert.ok(index.indexOf("/novel-navigation-v1723c.css") < index.indexOf("/companion-core-polish-v176.css"));
assert.ok(index.indexOf("/novel-navigation-v1723c.js") < index.indexOf("/companion-function-pack-v177.js"));

assert.match(js, /dataset\?\.uaiMode === "novel"/);
assert.match(js, /novelV1723OpenLibrary/);
assert.match(js, /novelV1723OpenStudio/);
assert.match(js, /libraryToggleBtn/);
assert.match(js, /studioToggleBtn/);
assert.match(js, /novel-v1723-session-delete/);
assert.match(js, /findCoreDeleteButton/);
assert.match(js, /favorite\.insertAdjacentElement\("afterend", button\)/);
assert.match(js, /novelV1723MoreTools/);
assert.match(js, /storyMemoryBtn/);
assert.match(js, /continuityBtn/);
assert.doesNotMatch(js, /UnlimitedCompanion|uai_companion_|uaiCompanionRoot/);

assert.match(css, /V17\.23C Novel Navigation/);
assert.match(css, /body\[data-uai-mode="novel"\]\.library-collapsed #novelV1723OpenLibrary/);
assert.match(css, /body\[data-uai-mode="novel"\]\.studio-collapsed #novelV1723OpenStudio/);
assert.match(css, /library-collapsed #libraryToggleBtn/);
assert.match(css, /studio-collapsed #studioToggleBtn/);
assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) 30px 48px/);
assert.match(css, /\.novel-v1723-session-delete/);
assert.match(css, /\.novel-v1723-more-tools-menu/);
assert.doesNotMatch(css, /#uaiCompanionRoot|data-uai-mode="companion"|\.uai-c-/);

// V17.23D remains a rollback-friendly novel enhancement layer loaded by the
// stable V17.23A novel entry rather than by the companion production chain.
assert.match(simplifyJs, /novel-final-v1723d\.css/);
assert.match(simplifyJs, /novel-final-v1723d\.js/);
assert.match(simplifyJs, /v17\.23d-novel-final-ux/);
assert.match(finalJs, /2026-08-23-v17\.23d-novel-final-ux/);
assert.match(finalJs, /dataset\?\.uaiMode === "novel"/);
assert.match(finalJs, /novelV1723TopMore/);
assert.match(finalJs, /novelV1723CurrentWork/);
assert.match(finalJs, /novelV1723QuickBtn/);
assert.match(finalJs, /继续正文/);
assert.match(finalJs, /推进剧情/);
assert.match(finalJs, /写对话/);
assert.match(finalJs, /规划本章/);
assert.match(finalJs, /润色/);
assert.match(finalJs, /检查剧情/);
assert.match(finalJs, /novelV1723Onboarding/);
assert.match(finalJs, /cfw_novel_onboarding_v1723d/);
assert.match(finalJs, /textarea\.dispatchEvent\(new Event\("input"/);
assert.doesNotMatch(finalJs, /UnlimitedCompanion|uai_companion_|uaiCompanionRoot/);

assert.match(finalCss, /V17\.23D Novel Final UX/);
assert.match(finalCss, /body\[data-uai-mode="novel"\] #topbar #readerBtn/);
assert.match(finalCss, /\.novel-v1723d-quick-menu/);
assert.match(finalCss, /\.novel-v1723d-onboarding/);
assert.match(finalCss, /max-height:\s*calc\(100dvh - 40px\)/);
assert.match(finalCss, /overflow-y:\s*auto/);
assert.doesNotMatch(finalCss, /#uaiCompanionRoot|data-uai-mode="companion"|\.uai-c-/);

assert.match(deployStatus, /"novelRevision": "2026-08-23-v17\.23d-novel-final-ux"/);
assert.match(deployStatus, /"status": "v17\.23d-novel-final-ux-current"/);
assert.match(readme, /小说工作区：\*\*V17\.23D Novel Final UX\*\*/);
assert.match(readme, /V17\.23C — 作品 \/ 章节 \/ 创作资料导航 ✅ 已完成/);
assert.match(readme, /V17\.23D — 输入区、顶部栏和最终 UX 收口 ✅ 已完成/);
assert.match(readme, /V17\.24 用户体验回归 \/ Bugfix 阶段/);
assert.match(readme, /收藏旁删除/);

console.log("V17.23C navigation + V17.23D final UX contract passed.");
