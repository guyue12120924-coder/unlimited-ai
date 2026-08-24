import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const simplifyJs = fs.readFileSync("public/novel-simplify-v1723.js", "utf8");
const finalJs = fs.readFileSync("public/novel-final-v1723d.js", "utf8");
const finalCss = fs.readFileSync("public/novel-final-v1723d.css", "utf8");
const deployStatus = JSON.parse(fs.readFileSync("public/deploy-status.json", "utf8"));
const readme = fs.readFileSync("README.md", "utf8");

assert.match(index, /meta name="unlimited-novel-revision"/);

assert.match(simplifyJs, /novel-final-v1723d\.css/);
assert.match(simplifyJs, /novel-final-v1723d\.js/);
assert.match(simplifyJs, /20260823-v17\.23d-novel-final-ux/);

assert.match(finalJs, /2026-08-23-v17\.23d-novel-final-ux/);
assert.match(finalJs, /dataset\?\.uaiMode === "novel"/);
assert.match(finalJs, /novelV1723CurrentWork/);
assert.match(finalJs, /novelV1723TopMore/);
assert.match(finalJs, /novelV1723QuickBtn/);
assert.match(finalJs, /novelV1723Onboarding/);
assert.match(finalJs, /cfw_novel_onboarding_v1723d/);
assert.match(finalJs, /继续正文/);
assert.match(finalJs, /推进剧情/);
assert.match(finalJs, /写对话/);
assert.match(finalJs, /规划本章/);
assert.match(finalJs, /润色/);
assert.match(finalJs, /检查剧情/);
assert.match(finalJs, /textarea\.dispatchEvent\(new Event\("input"/);
assert.doesNotMatch(finalJs, /UnlimitedCompanion|uai_companion_|uaiCompanionRoot/);

assert.match(finalCss, /V17\.23D Novel Final UX/);
assert.match(finalCss, /body\[data-uai-mode="novel"\] #topbar #readerBtn/);
assert.match(finalCss, /body\[data-uai-mode="novel"\] #topbar #personaToggle/);
assert.match(finalCss, /body\[data-uai-mode="novel"\] #topbar #commandBtn/);
assert.match(finalCss, /\.novel-v1723d-quick-menu/);
assert.match(finalCss, /\.novel-v1723d-onboarding/);
assert.match(finalCss, /max-height:\s*calc\(100dvh - 40px\)/);
assert.match(finalCss, /overflow-y:\s*auto/);
assert.match(finalCss, /@media \(max-width: 520px\)/);
assert.doesNotMatch(finalCss, /#uaiCompanionRoot|data-uai-mode="companion"|\.uai-c-/);

assert.match(deployStatus.novel.finalUx, /V17\.23D/);
assert.ok(String(deployStatus.novelRevision || "").length > 0);
assert.ok(String(deployStatus.status || "").length > 0);

assert.match(readme, /V17\.23D/);

console.log("V17.23D historical novel final UX contract passed.");
