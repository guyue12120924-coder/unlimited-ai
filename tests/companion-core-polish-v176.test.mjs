import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("public/index.html", "utf8");
const css = fs.readFileSync("public/companion-core-polish-v176.css", "utf8");
const boot = fs.readFileSync("public/boot-diagnostics.js", "utf8");

assert.match(index, /companion-core-polish-v176\.css\?v=20260822-v17\.6-safe-polish/);
assert.match(boot, /companion-entry-v175\.js/,
  "safe polish must not replace the proven V17.5 core-only entry");
assert.doesNotMatch(boot, /companion-entry-v17[1-4]\.js|companion-assets-loader-v174\.js/,
  "legacy structural companion enhancement loaders must stay out of the active boot chain");

assert.match(css, /V17\.6 Safe Polish/);
assert.doesNotMatch(css, /\.uai-c-shell\s*\{[^}]*grid-template-columns/s,
  "polish must not change the stable shell column layout");
assert.doesNotMatch(css, /\.uai-c-main\s*\{[^}]*grid-template-rows/s,
  "polish must not change the stable header\/messages\/composer row layout");
assert.doesNotMatch(css, /\.uai-c-messages\s*\{[^}]*display\s*:\s*none/s,
  "polish must never hide the message area");
assert.doesNotMatch(css, /\.uai-c-composer-wrap\s*\{[^}]*display\s*:\s*none/s,
  "polish must never hide the composer");
assert.doesNotMatch(css, /\.uai-c-input\s*\{[^}]*display\s*:\s*none/s,
  "polish must never hide the chat input");
assert.doesNotMatch(css, /position\s*:\s*fixed[^}]*\.uai-c-messages/s,
  "polish must not detach the message area from the stable core grid");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.uai-c-message-row:last-child\s*\{\s*animation:/,
  "only the newest message should receive the lightweight entrance animation");
assert.doesNotMatch(css, /\.uai-c-message-row\s*\{[^}]*animation:/s,
  "historical messages must not all animate on a 100+ message conversation");

console.log("V17.6 safe companion polish contract passed: the stable core layout remains untouched while visual polish stays CSS-only and reduced-motion aware.");
