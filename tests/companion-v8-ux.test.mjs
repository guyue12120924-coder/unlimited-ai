import assert from "node:assert/strict";
import fs from "node:fs";

const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");
const controls = fs.readFileSync("public/companion-create-controls.js", "utf8");
const lengths = fs.readFileSync("public/companion-reply-length.js", "utf8");
const css = fs.readFileSync("public/companion-profile-editor.css", "utf8");

assert.match(boot, /v8\.0-dual-mode/);
assert.match(controls, /PROFILE_LIMIT = 5000/);
assert.match(controls, /MAX_CHARACTERS = 6/);
assert.match(controls, /function openCreate\(/);
assert.match(controls, /function openEditor\(/);
assert.match(controls, /uaiCompanionRoleAdd/);
assert.match(controls, /完整角色设定/);
assert.match(controls, /约 500 字/);
assert.match(controls, /约 1000 字/);
assert.match(controls, /约 5000 字/);
assert.match(lengths, /chars: 500/);
assert.match(lengths, /chars: 1000/);
assert.match(lengths, /chars: 5000/);
assert.match(css, /uaiCompanionV4Search/);
assert.match(css, /uaiCompanionQuickBar/);
assert.match(css, /uai-c-long-reply/);
assert.doesNotMatch(controls, /COMPANION_ROLE_CARD/);
assert.doesNotMatch(lengths, /COMPANION_ROLE_CARD/);

console.log("Companion V8 UX contract passed.");