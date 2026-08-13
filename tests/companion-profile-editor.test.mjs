import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const editor = fs.readFileSync("public/companion-profile-editor.js", "utf8");

assert.match(boot, /companion-profile-editor\.js/);
assert.match(boot, /companion-profile-editor\.css/);
assert.match(boot, /companionProfileEditorReady/);
assert.match(editor, /PROFILE_LIMIT = 900/);
assert.match(editor, /完整角色设定/);
assert.match(editor, /uaiV7Background/);
assert.match(editor, /uaiV7NewBackground/);
assert.match(editor, /uaiOnboardDesc/);
assert.match(editor, /uaiCompanionAddCharacter/);
assert.match(editor, /data-v7-edit-character/);
assert.match(editor, /personality: PROFILE_MARKER/);
assert.match(editor, /speakingStyle: PROFILE_MARKER/);
assert.match(editor, /\.uai-c-chip-grid/);
console.log("Companion profile editor contract passed.");
