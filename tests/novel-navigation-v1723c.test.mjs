import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const js = fs.readFileSync("public/novel-navigation-v1723c.js", "utf8");
const css = fs.readFileSync("public/novel-navigation-v1723c.css", "utf8");
const readme = fs.readFileSync("README.md", "utf8");

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

assert.match(readme, /V17\.23C — 作品 \/ 章节 \/ 创作资料导航 ✅ 已完成/);
assert.match(readme, /收藏旁删除/);

console.log("V17.23C novel navigation contract passed.");
