import assert from "node:assert/strict";
import fs from "node:fs";

const loader = fs.readFileSync("public/novel-simplify-v1723.js", "utf8");
const css = fs.readFileSync("public/novel-ui-v1724b.css", "utf8");
const studio = fs.readFileSync("public/studio.js", "utf8");

assert.match(loader, /novel-ui-v1724b\.css/);
assert.match(loader, /20260823-v17\.24b-visual-unification/);
assert.doesNotMatch(loader, /novel-ui-v1724b\.js/);

assert.match(css, /V17\.24B Novel Visual Unification/);
assert.match(css, /body\[data-uai-mode="novel"\]/);
assert.match(css, /data-novel-v1723-theme="light"/);
assert.match(css, /data-novel-v1723-theme="dark"/);
assert.match(css, /#conversationPane \.bubble/);
assert.match(css, /#composer/);
assert.match(css, /#studioPanel \.studio-tabs/);
assert.match(css, /\.novel-v1724a-library-tools-panel/);
assert.match(css, /#sessionPanel/);
assert.doesNotMatch(css, /#uaiCompanionRoot|data-uai-mode="companion"|\.uai-c-/);

// V17.24B is visual-only: core feature controls must still exist and may not be hidden here.
for (const id of ["workspaceSearch", "readProject", "exportProject", "backupWorkspace", "restoreWorkspace", "addChapter", "studioNewSession"]) {
  assert.match(studio, new RegExp(`id=\\"${id}\\"`));
  assert.doesNotMatch(css, new RegExp(`#${id}\\s*\\{[^}]*display:\\s*none`, "si"));
}

assert.doesNotMatch(css, /position:\s*fixed[^}]*#conversationPane/si);

console.log("V17.24B visual unification contract passed.");
