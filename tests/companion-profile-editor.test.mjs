import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const editor = fs.readFileSync("public/companion-create-controls.js", "utf8");
const css = fs.readFileSync("public/companion-profile-editor.css", "utf8");

assert.doesNotMatch(boot, /ensureScript\(`\/companion-profile-editor\.js/);
assert.match(boot, /companion-profile-editor\.css/);
assert.match(boot, /companionCharacterControlsReady/);
assert.match(editor, /PROFILE_LIMIT = 5000/);
assert.match(editor, /完整角色设定/);
assert.match(editor, /uaiV8Background/);
assert.match(editor, /uaiV8NewBackground/);
assert.match(editor, /uaiOnboardDesc/);
assert.match(editor, /uaiCompanionAddCharacter/);
assert.match(editor, /personality: PROFILE_MARKER/);
assert.match(editor, /speakingStyle: PROFILE_MARKER/);
assert.match(css, /uai-c-v8-role-editor/);

console.log("Companion V8 role editor contract passed.");
