import assert from "node:assert/strict";
import fs from "node:fs";

const loader = fs.readFileSync("public/novel-simplify-v1723.js", "utf8");
const js = fs.readFileSync("public/novel-writing-v1725.js", "utf8");
const css = fs.readFileSync("public/novel-writing-v1725.css", "utf8");
const hotfixJs = fs.readFileSync("public/novel-writing-v1725-hotfix2.js", "utf8");
const hotfixCss = fs.readFileSync("public/novel-writing-v1725-hotfix2.css", "utf8");
const polish5Js = fs.readFileSync("public/novel-writing-v1725-polish5.js", "utf8");
const polish5Css = fs.readFileSync("public/novel-writing-v1725-polish5.css", "utf8");
const finalJs = fs.readFileSync("public/novel-writing-v1725-final.js", "utf8");
const finalCss = fs.readFileSync("public/novel-writing-v1725-final.css", "utf8");
const studio = fs.readFileSync("public/studio.js", "utf8");
const simple = fs.readFileSync("public/simple-studio.js", "utf8");
const aiToManuscript = fs.readFileSync("public/ai-to-manuscript.js", "utf8");
const index = fs.readFileSync("public/index.html", "utf8");
const deploy = JSON.parse(fs.readFileSync("public/deploy-status.json", "utf8"));

// The original manuscript-first layer remains part of the chain.
assert.match(loader, /novel-writing-v1725\.css/);
assert.match(loader, /novel-writing-v1725\.js/);
assert.match(js, /2026-08-24-v17\.25-writing-workspace-redesign/);
assert.match(js, /simpleManuscriptEditor/);
assert.match(js, /data-v1725-view="manuscript"/);
assert.match(js, /data-v1725-view="ai"/);
assert.match(js, /novelV1725ManuscriptProxy/);
assert.match(js, /proxy\.dataset\.chapterField = "manuscript"/);
assert.doesNotMatch(js, /UnlimitedCompanion|uai_companion_|uaiCompanionRoot/);
assert.match(css, /V17\.25 Writing Workspace Redesign/);
assert.match(css, /body\[data-uai-mode="novel"\]/);
assert.match(css, /\.novel-v1725-manuscript-view/);
assert.match(css, /#simpleManuscriptEditor\.novel-v1725-editor/);
assert.match(css, /#studioPanel\s*\{/);
assert.doesNotMatch(css, /#uaiCompanionRoot|data-uai-mode="companion"|\.uai-c-/);

// Screenshot-driven fixes remain intact: no desktop blur and no nested manuscript scroll.
assert.match(index, /novel-writing-v1725-hotfix2\.css\?v=20260824-v17\.25-writing-workspace-polish4/);
assert.match(index, /novel-writing-v1725-hotfix2\.js\?v=20260824-v17\.25-writing-workspace-polish4/);
assert.match(hotfixCss, /@media \(min-width: 981px\)[\s\S]*novel-v1725-drawer-scrim[\s\S]*display:\s*none\s*!important/);
assert.match(hotfixCss, /#simpleManuscriptEditor\.novel-v1725-editor[\s\S]*overflow-y:\s*hidden\s*!important/);
assert.match(hotfixJs, /fitEditor/);
assert.match(hotfixJs, /ResizeObserver/);
assert.match(hotfixJs, /让 AI 续写、润色或帮你构思/);
assert.doesNotMatch(hotfixJs, /UnlimitedCompanion|uai_companion_|uaiCompanionRoot/);

// Polish 5 keeps chapters and AI conversations available without showing both long lists at once.
assert.match(index, /novel-writing-v1725-polish5\.css\?v=20260824-v17\.25-writing-workspace-polish5/);
assert.match(index, /novel-writing-v1725-polish5\.js\?v=20260824-v17\.25-writing-workspace-polish5/);
assert.match(polish5Css, /novel-v1725-library-switch/);
assert.match(polish5Css, /data-novel-library-view="chapters"/);
assert.match(polish5Css, /data-novel-library-view="sessions"/);
assert.match(polish5Js, /setLibraryView\("chapters"\)/);
assert.match(polish5Js, /setLibraryView\("sessions"\)/);
assert.doesNotMatch(polish5Js, /UnlimitedCompanion|uai_companion_|uaiCompanionRoot/);

// Final consolidation must be loaded directly and must be the last CSS/JS layer.
assert.match(index, /unlimited-novel-revision" content="2026-08-24-v17\.25-final-writing-ui"/);
assert.match(index, /novel-writing-v1725-final\.css\?v=20260824-v17\.25-final-writing-ui/);
assert.match(index, /novel-writing-v1725-final\.js\?v=20260824-v17\.25-final-writing-ui/);
assert.ok(index.indexOf("novel-writing-v1725-final.css") > index.indexOf("companion-luminous-shell-v1719.css"));
assert.ok(index.indexOf("novel-writing-v1725-final.js") > index.indexOf("companion-audio-gesture-v1716.js"));

assert.match(finalCss, /V17\.25 Final Writing UI Consolidation/);
assert.match(finalCss, /body\[data-uai-mode="novel"\]/);
assert.match(finalCss, /#sessionBtn[\s\S]*display:\s*none\s*!important/);
assert.match(finalCss, /#novelV1725MaterialsBtn[\s\S]*display:\s*none\s*!important/);
assert.match(finalCss, /novel-v1725-library-switch/);
assert.match(finalCss, /#simpleManuscriptEditor\.novel-v1725-editor[\s\S]*font-size:\s*17px\s*!important/);
assert.match(finalCss, /#simpleManuscriptEditor\.novel-v1725-editor[\s\S]*line-height:\s*2\s*!important/);
assert.match(finalCss, /#conversationPane \.input-floating/);
assert.match(finalCss, /#studioPanel \.studio-tabs \[data-studio-tab="scenes"\][\s\S]*display:\s*none\s*!important/);
assert.match(finalCss, /@media \(min-width: 981px\)[\s\S]*novel-v1725-drawer-scrim[\s\S]*display:\s*none\s*!important/);
assert.match(finalCss, /@media \(max-width: 980px\)[\s\S]*backdrop-filter:\s*none\s*!important/);
assert.doesNotMatch(finalCss, /#uaiCompanionRoot|data-uai-mode="companion"|\.uai-c-/);

assert.match(finalJs, /2026-08-24-v17\.25-final-writing-ui/);
assert.match(finalJs, /data-v1725-final-target/);
assert.match(finalJs, /sessionBtn/);
assert.match(finalJs, /管理、重命名或删除 AI 对话/);
assert.match(finalJs, /window\.innerWidth <= 980/);
assert.match(finalJs, /focusExplicitView/);
assert.match(finalJs, /setLibraryView\?\.\(target\)/);
assert.match(finalJs, /data-studio-tab="outline"/);
assert.match(finalJs, /fitEditor/);
assert.doesNotMatch(finalJs, /UnlimitedCompanion|uai_companion_|uaiCompanionRoot/);

// Existing capabilities stay present in stable cores even when low-frequency controls are hidden in the final UI.
for (const id of [
  "workspaceSearch",
  "readProject",
  "exportProject",
  "backupWorkspace",
  "restoreWorkspace",
  "addChapter",
  "studioNewSession"
]) {
  assert.match(studio, new RegExp(`id=\\"${id}\\"`));
}
assert.match(simple, /chapter\.manuscript/);
assert.match(simple, /simpleManuscriptEditor/);
assert.match(aiToManuscript, /加入正文/);
assert.match(aiToManuscript, /chapter\.manuscript/);

assert.equal(deploy.novelRevision, "2026-08-24-v17.25-final-writing-ui");
assert.equal(deploy.status, "v17.25-final-writing-ui-current");
assert.match(deploy.novel.writingPolish, /final writing UI/i);

console.log("V17.25 final writing UI contract passed.");
