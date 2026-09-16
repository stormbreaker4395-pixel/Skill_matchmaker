import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const mainHtml = fs.readFileSync(new URL("../client/main.html", import.meta.url), "utf8");
const mainJs = fs.readFileSync(new URL("../client/main.js", import.meta.url), "utf8");

test("frontend entrypoint is the single main application", () => {
  assert.match(mainHtml, /main\.js/);
  assert.doesNotMatch(mainHtml, /profile\.js|candidate-optin\.js|org-tools\.js|app\.js/);
});

test("frontend no longer uses DOM polling and has shared escaping/auth hooks", () => {
  assert.doesNotMatch(mainJs, /setInterval\s*\(/);
  assert.match(mainJs, /const esc\s*=\s*\(/);
  assert.match(mainJs, /Authorization/);
});
