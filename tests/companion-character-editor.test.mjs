import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const entry = fs.readFileSync("public/companion-entry-v175.js", "utf8");
const editor = fs.readFileSync("public/companion-character-editor.js", "utf8");
const css = fs.readFileSync("public/companion-support.css", "utf8");

assert.match(boot, /2026-08-22-v17\.5-companion-core-only-rollback/);
assert.match(boot, /companion-entry-v175\.js/);
assert.doesNotMatch(boot, /companion-character-editor\.js|companion-support\.css/,
  "optional character editor assets must stay out of the active rollback boot chain");
assert.doesNotMatch(entry, /companion-character-editor\.js|companion-support\.css/);

assert.match(editor, /v9\.3-character-editor/);
assert.match(editor, /PROFILE_LIMIT = 5000/);
assert.match(editor, /MAX_CHARACTERS = 6/);
assert.match(editor, /完整角色设定/);
assert.match(editor, /uaiV9RoleBackground/);
assert.match(editor, /uaiV9NewRoleBackground/);
assert.match(editor, /uaiOnboardDesc/);
assert.match(editor, /uaiCompanionAddCharacter/);
assert.match(css, /#uaiV9RoleBackground/);
assert.match(css, /#uaiV9NewRoleBackground/);

console.log("Companion character editor source remains intact but dormant under the V17.5 core-only rollback.");