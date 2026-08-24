import assert from "node:assert/strict";
import fs from "node:fs";

const loader = fs.readFileSync("public/novel-simplify-v1723.js", "utf8");
const js = fs.readFileSync("public/novel-writing-v1725.js", "utf8");
const css = fs.readFileSync("public/novel-writing-v1725.css", "utf8");
const studio = fs.readFileSync("public/studio.js", "utf8");
const simple = fs.readFileSync("public/simple-studio.js", "utf8");
const aiToManuscript = fs.readFileSync("public/ai-to-manuscript.js", "utf8");
const index = fs.readFileSync("public/index.html", "utf8");
const deploy = JSON.parse(fs.readFileSync("public/deploy-status.json", "utf8"));

assert.match(loader, /novel-writing-v1725\.css/);
assert.match(loader, /novel-writing-v1725\.js/);
assert.match(loader, /20260824-v17\.25-writing-workspace-redesign/);
assert.ok(loader.indexOf("novel-ui-v1724c.js") < loader.indexOf("novel-writing-v1725.js"));

// V17.25 must also be loaded directly from index so a stale historical loader cache
// cannot leave users on the old V17.24 three-column interface.
assert.match(index, /novel-writing-v1725\.css\?v=20260824-v17\.25-writing-workspace-redesign-fix1/);
assert.match(index, /novel-writing-v1725\.js\?v=20260824-v17\.25-writing-workspace-redesign-fix1/);
assert.match(index, /novel-simplify-v1723\.js\?v=20260824-v17\.25-entry-refresh/);

assert.match(js, /2026-08-24-v17\.25-writing-workspace-redesign/);
assert.match(js, /dataset\?\.uaiMode === "novel"/);
assert.match(js, /novelV1725ManuscriptView/);
assert.match(js, /simpleManuscriptEditor/);
assert.match(js, /data-v1725-view="manuscript"/);
assert.match(js, /data-v1725-view="ai"/);
assert.match(js, /novelV1725MaterialsBtn/);
assert.match(js, /novelV1725ManuscriptProxy/);
assert.match(js, /proxy\.dataset\.chapterField = "manuscript"/);
assert.match(js, /proxy\.dispatchEvent\(new Event\("input"/);
assert.match(js, /window\.innerWidth <= 980/);
assert.match(js, /MutationObserver/);
assert.match(js, /attributeFilter: \["data-uai-mode"\]/);
assert.match(js, /settleNovelEntry/);
assert.match(js, /window\.innerWidth > 980/);
assert.match(js, /editor\.focus\(\{ preventScroll: true \}\)/);
assert.match(js, /aiInput\.blur\(\)/);
assert.match(js, /user-flow-add-manuscript/);
assert.match(js, /setView\("ai"\)/);
assert.match(js, /setView\("manuscript"\)/);
assert.doesNotMatch(js, /UnlimitedCompanion|uai_companion_|uaiCompanionRoot/);

assert.match(css, /V17\.25 Writing Workspace Redesign/);
assert.match(css, /body\[data-uai-mode="novel"\]/);
assert.match(css, /grid-template-columns:\s*var\(--studio-left\) minmax\(0, 1fr\)/);
assert.match(css, /\.novel-v1725-manuscript-view/);
assert.match(css, /#simpleManuscriptEditor\.novel-v1725-editor/);
assert.match(css, /\.novel-v1725-ai-view #conversationPane #history/);
assert.match(css, /#studioPanel\s*\{/);
assert.match(css, /position:\s*fixed\s*!important/);
assert.match(css, /\.novel-v1725-materials-btn/);
assert.match(css, /#studioPanel \.studio-tabs \[data-studio-tab="draft"\]/);
assert.match(css, /display:\s*none\s*!important/);
assert.match(css, /\.novel-v1725-drawer-scrim[\s\S]*left:\s*var\(--studio-left\)/);
assert.doesNotMatch(css, /#uaiCompanionRoot|data-uai-mode="companion"|\.uai-c-/);

// Existing capabilities stay present in the stable cores.
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

assert.match(index, /unlimited-novel-revision" content="2026-08-24-v17\.25-writing-workspace-redesign"/);
assert.equal(deploy.novelRevision, "2026-08-24-v17.25-writing-workspace-redesign");
assert.equal(deploy.status, "v17.25-writing-workspace-redesign-current");
assert.match(deploy.novel.writingWorkspace, /V17\.25/);

console.log("V17.25 writing workspace contract passed with direct cache-safe asset loading.");
