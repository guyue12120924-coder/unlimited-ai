import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const js = fs.readFileSync("public/novel-sessions-v1723b.js", "utf8");
const css = fs.readFileSync("public/novel-sessions-v1723b.css", "utf8");
const readme = fs.readFileSync("README.md", "utf8");

assert.match(index, /meta name="unlimited-novel-revision"/);
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

assert.match(readme, /V17\.23B/);

console.log("V17.23B historical novel session management contract passed.");
