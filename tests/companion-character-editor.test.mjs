import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const loader = fs.readFileSync("public/companion-assets-loader-v174.js", "utf8");
const editor = fs.readFileSync("public/companion-character-editor.js", "utf8");
const css = fs.readFileSync("public/companion-support.css", "utf8");

assert.match(boot, /2026-08-22-v17\.4-companion-verified-commit/);
assert.match(boot, /companionCharacterControlsReady/);
assert.match(loader, /companion-support\.css/);
assert.match(loader, /companion-character-editor\.js/);
assert.doesNotMatch(loader, /companion-profile-editor\.css|companion-profile-editor\.js|companion-characters-ui\.js/);
assert.match(editor, /v9\.3-character-editor/);
assert.match(editor, /PROFILE_LIMIT = 5000/);
assert.match(editor, /MAX_CHARACTERS = 6/);
assert.match(editor, /完整角色设定/);
assert.match(editor, /uaiV9RoleBackground/);
assert.match(editor, /uaiV9NewRoleBackground/);
assert.match(editor, /uaiOnboardDesc/);
assert.match(editor, /uaiCompanionAddCharacter/);
assert.match(editor, /personality: PROFILE_MARKER/);
assert.match(editor, /speakingStyle: PROFILE_MARKER/);
assert.doesNotMatch(editor, /ensureRoleToolbar/);
assert.doesNotMatch(editor, /simplifySettingsModal/);
assert.doesNotMatch(editor, /enhanceLongReplies/);
assert.match(css, /#uaiV9RoleBackground/);
assert.match(css, /#uaiV9NewRoleBackground/);
assert.match(css, /uai-c-v8-length-pills/);

console.log("Companion character editor contract passed under the V17.4 loader.");
