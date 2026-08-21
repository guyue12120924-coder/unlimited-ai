import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("public/index.html");
const workspace = read("public/workspace-ui-v17.js");
const collaboration = read("public/ai-collaboration-v17.js");

assert.match(index, /unlimited-runtime-revision" content="2026-08-21-v17\.0-workspace-consolidation/);
assert.match(index, /workspace-ui-v17\.js\?v=20260821-v17\.0/);
assert.match(index, /ai-collaboration-v17\.js\?v=20260821-v17\.0/);
assert(index.indexOf("/workspace-ui-v17.js") < index.indexOf("/ai-collaboration-v17.js"), "workspace UI must initialize before collaboration adapters");
for (const legacy of ["novel-workspace-v15.js", "novel-workspace-v151.js", "novel-workspace-v152.js", "novel-workspace-v153.js"]) {
  assert.doesNotMatch(index, new RegExp(`<script[^>]+${legacy.replaceAll(".", "\\.")}`), `${legacy} must not be loaded after V17 consolidation`);
}
for (const css of ["novel-workspace-v15.css", "novel-workspace-v151.css", "novel-workspace-v152.css", "novel-workspace-v153.css"]) {
  assert.match(index, new RegExp(css.replaceAll(".", "\\.")), `${css} remains the compatibility style source during V17.0`);
}

assert.match(workspace, /2026-08-21-v17\.0-workspace-ui/);
assert.match(workspace, /window\.UnlimitedWorkspaceUIV17 = api/);
assert.match(workspace, /window\.UnlimitedNovelWorkspaceV15 =/);
assert.match(workspace, /window\.UnlimitedNovelWorkspaceV151 =/);
assert.match(workspace, /novelV15ContextBar/);
assert.match(workspace, /novelV151PanelGuide/);
assert.match(workspace, /data-novel-v15-prompt/);
assert.match(workspace, /data-v151-action/);
assert.match(workspace, /uai:workspace-refresh/);
assert.match(workspace, /uai:mode-refresh/);
assert.match(workspace, /UnlimitedV3\?\.schedule/);
assert.doesNotMatch(workspace, /new MutationObserver/);

assert.match(collaboration, /2026-08-21-v17\.0-ai-collaboration/);
assert.match(collaboration, /window\.UnlimitedAICollaborationV17 = api/);
assert.match(collaboration, /window\.UnlimitedNovelWorkspaceV152 =/);
assert.match(collaboration, /window\.UnlimitedNovelWorkspaceV153 =/);
assert.match(collaboration, /novelV152WritingNow/);
assert.match(collaboration, /novel-v153-reply-actions/);
assert.match(collaboration, /user-flow-add-manuscript/);
assert.match(collaboration, /data-added-chapter-id/);
assert.match(collaboration, /bindActiveChapterToSession/);
assert.match(collaboration, /replyPromptFor/);
assert.match(collaboration, /uai:chat-refresh/);
assert.match(collaboration, /UnlimitedV3\?\.schedule/);
assert.doesNotMatch(collaboration, /new MutationObserver/);
assert.doesNotMatch(collaboration, /sendBtn\.click|\.click\(\).*sendBtn/, "reply actions must still prepare prompts without auto-sending them");

console.log("V17.0 consolidation contract passed: four V15 JS layers are delivered as two canonical modules with compatibility APIs and shared events.");
