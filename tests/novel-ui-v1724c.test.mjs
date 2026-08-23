import assert from "node:assert/strict";
import fs from "node:fs";

const loader = fs.readFileSync("public/novel-simplify-v1723.js", "utf8");
const js = fs.readFileSync("public/novel-ui-v1724c.js", "utf8");
const css = fs.readFileSync("public/novel-ui-v1724c.css", "utf8");
const studio = fs.readFileSync("public/studio.js", "utf8");
const index = fs.readFileSync("public/index.html", "utf8");
const deploy = JSON.parse(fs.readFileSync("public/deploy-status.json", "utf8"));

assert.match(loader, /novel-ui-v1724c\.css/);
assert.match(loader, /novel-ui-v1724c\.js/);
assert.match(loader, /20260823-v17\.24c-final-regression-polish/);
assert.ok(loader.indexOf("novel-ui-v1724b.css") < loader.indexOf("novel-ui-v1724c.css"));

assert.match(js, /2026-08-23-v17\.24c-final-regression-polish/);
assert.match(js, /dataset\?\.uaiMode === "novel"/);
for (const id of [
  "novelV1723TopMore",
  "novelV1723QuickBtn",
  "novelV1723MoreTools",
  "novelV1724ALibraryToolsBtn"
]) {
  assert.match(js, new RegExp(id));
}
assert.match(js, /closeFloating/);
assert.match(js, /novelV1723ProjectName/);
assert.match(js, /novelV1723ChapterName/);
assert.match(js, /studio-item-main span/);
assert.match(js, /window\.innerWidth <= 980/);
assert.match(js, /collapseLibrary/);
assert.match(js, /document\.getElementById\("msg"\)\?\.focus/);
assert.doesNotMatch(js, /localStorage|UnlimitedCompanion|uai_companion_|uaiCompanionRoot/);

assert.match(css, /V17\.24C Novel Final Regression Polish/);
assert.match(css, /body\[data-uai-mode="novel"\]/);
assert.match(css, /max-width:\s*calc\(100vw/);
assert.match(css, /\.novel-v1723d-onboarding-close/);
assert.match(css, /position:\s*absolute\s*!important/);
assert.match(css, /@media \(max-width: 980px\)/);
assert.match(css, /@media \(max-height: 620px\)/);
assert.doesNotMatch(css, /#uaiCompanionRoot|data-uai-mode="companion"|\.uai-c-/);

// Final polish must not remove original feature controls.
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
  assert.doesNotMatch(css, new RegExp(`#${id}\\s*\\{[^}]*display\\s*:\\s*none`, "is"));
}

assert.match(index, /unlimited-novel-revision" content="2026-08-23-v17\.24c-final-regression-polish"/);
assert.equal(deploy.novelRevision, "2026-08-23-v17.24c-final-regression-polish");
assert.equal(deploy.status, "v17.24c-final-regression-polish-current");
assert.match(deploy.novel.uiPass3, /V17\.24C/);

console.log("V17.24C final novel UX contract passed.");
