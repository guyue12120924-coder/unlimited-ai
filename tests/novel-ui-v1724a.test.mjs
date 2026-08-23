import assert from "node:assert/strict";
import fs from "node:fs";

const studio = fs.readFileSync("public/studio.js", "utf8");
const loader = fs.readFileSync("public/novel-simplify-v1723.js", "utf8");
const js = fs.readFileSync("public/novel-ui-v1724a.js", "utf8");
const css = fs.readFileSync("public/novel-ui-v1724a.css", "utf8");

assert.match(loader, /novel-ui-v1724a\.css/);
assert.match(loader, /novel-ui-v1724a\.js/);
assert.match(loader, /20260823-v17\.24a-interface-simplification/);

assert.match(js, /2026-08-23-v17\.24a-interface-simplification/);
assert.match(js, /dataset\?\.uaiMode === "novel"/);
assert.match(js, /novelV1724ALibraryTools/);
assert.match(js, /AI 对话/);
assert.match(js, /世界观/);
assert.match(js, /querySelector\(":scope > \.studio-search"\)/);
assert.match(js, /querySelector\(":scope > \.library-footer"\)/);
assert.match(js, /panel\.appendChild\(search\)/);
assert.match(js, /panel\.appendChild\(footer\)/);
assert.doesNotMatch(js, /UnlimitedCompanion|uai_companion_|uaiCompanionRoot/);

// Original feature controls must remain in the stable studio core.
for (const id of ["workspaceSearch", "readProject", "exportProject", "backupWorkspace", "restoreWorkspace"]) {
  assert.match(studio, new RegExp(`id=\\"${id}\\"`));
}

assert.match(css, /V17\.24A Novel Interface Simplification/);
assert.match(css, /body\[data-uai-mode="novel"\]/);
assert.match(css, /--studio-left:\s*232px/);
assert.match(css, /--studio-right:\s*296px/);
assert.match(css, /\.novel-v1724a-library-tools-panel/);
assert.match(css, /#conversationPane \.chat/);
assert.match(css, /max-width:\s*1040px/);
assert.match(css, /#studioPanel \.studio-tabs/);
assert.doesNotMatch(css, /#uaiCompanionRoot|data-uai-mode="companion"|\.uai-c-/);
assert.doesNotMatch(css, /#workspaceSearch\s*\{[^}]*display:\s*none/si);
assert.doesNotMatch(css, /#readProject\s*\{[^}]*display:\s*none/si);
assert.doesNotMatch(css, /#exportProject\s*\{[^}]*display:\s*none/si);
assert.doesNotMatch(css, /#backupWorkspace\s*\{[^}]*display:\s*none/si);
assert.doesNotMatch(css, /#restoreWorkspace\s*\{[^}]*display:\s*none/si);

console.log("V17.24A interface simplification contract passed.");
