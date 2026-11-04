// Unit test for the editor plugin's toolbar placement (wwAddToolbarButton in
// plugin/webapps/library/editor/ckextraplugins/warpwirecontentitem/plugin.js). The plugin adds its own button
// to Sakai's toolbar definition, so registration never edits the toolbar.
//
// Loads plugin.js in a sandbox with a stub CKEDITOR; no browser or Sakai needed.
// Run: node toolbar.test.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  join(HERE, "..", "plugin", "webapps", "library", "editor", "ckextraplugins", "warpwirecontentitem", "plugin.js"),
  "utf8",
);
const sandbox = { CKEDITOR: { plugins: { add() {} } } };
vm.runInNewContext(src, sandbox);
const add = sandbox.wwAddToolbarButton;

let failures = 0;
function assert(cond, msg) {
  console.log(`${cond ? "ok" : "not ok"} - ${msg}`);
  if (!cond) failures++;
}
const B = "WarpwireContentItem";

// Shape of Sakai 25.2's toolbar_Full (library/.../ckeditor.launch.js).
function sakaiFull(contentItem) {
  return {
    toolbar: "Full",
    toolbar_Full: [
      ["Format", "Bold"],
      "/",
      ["Blockquote", "Html5video", "AudioRecorder"],
      [contentItem ? "ContentItem" : undefined, undefined],
      ["atd-ckeditor"],
    ],
    toolbar_Basic: [["Source", "Bold"]],
  };
}

let c = sakaiFull(true);
assert(add(c, B) === true, "Full toolbar with ContentItem: returns true");
assert(
  JSON.stringify(c.toolbar_Full[3]) === JSON.stringify([B, "ContentItem", null]),
  "button placed directly before ContentItem",
);
add(c, B);
assert(
  JSON.stringify(c.toolbar_Full).split(B).length === 2,
  "second call does not duplicate the button",
);

c = sakaiFull(false);
assert(add(c, B) === true, "Full toolbar without ContentItem: returns true");
assert(
  JSON.stringify(c.toolbar_Full[3]) === JSON.stringify([B]),
  "button gets its own group after the media group",
);

c = sakaiFull(true);
c.toolbar = "Basic";
assert(add(c, B) === false, "Basic toolbar: no slot, returns false");
assert(
  JSON.stringify(c.toolbar_Basic) === JSON.stringify([["Source", "Bold"]]),
  "Basic toolbar unchanged",
);

c = { toolbar: [{ name: "insert", items: ["Image", "ContentItem"] }] };
assert(add(c, B) === true, "array toolbar with {name, items} groups");
assert(
  JSON.stringify(c.toolbar[0].items) ===
    JSON.stringify(["Image", B, "ContentItem"]),
  "button placed inside the items group",
);

c = { toolbar: [["ContentItem", B]] };
assert(add(c, B) === true, "button already present (e.g. a manual toolbar entry)");
assert(
  JSON.stringify(c.toolbar) === JSON.stringify([["ContentItem", B]]),
  "existing entry left alone",
);

assert(add({}, B) === false, "no toolbar definition (toolbarGroups): false");

// The button is the only change: removing it gives back the original toolbar,
// so every other item keeps its row and relative order.
const withoutButton = (rows) =>
  JSON.stringify(
    rows
      .map((r) => (Array.isArray(r) ? r.filter((i) => i !== B) : r && r.items ? { ...r, items: r.items.filter((i) => i !== B) } : r))
      .filter((r) => !(Array.isArray(r) && r.length === 0)),
  );
for (const contentItem of [true, false]) {
  c = sakaiFull(contentItem);
  const before = JSON.stringify(c.toolbar_Full);
  add(c, B);
  assert(
    withoutButton(c.toolbar_Full) === before,
    `other items unchanged in row and order (${contentItem ? "with" : "without"} ContentItem)`,
  );
}
c = { toolbar: [{ name: "insert", groups: ["insert"], items: ["Image", "ContentItem"] }] };
add(c, B);
assert(
  c.toolbar[0].name === "insert" && JSON.stringify(c.toolbar[0].groups) === '["insert"]',
  "{name, items} group keeps its other fields",
);

// A toolbar array shared by several configs is left unchanged; only the
// editor's own config gets the button. CKEditor's editor.config inherits from a
// shared config through its prototype, which this also covers.
const shared = sakaiFull(true).toolbar_Full;
const sharedBefore = JSON.stringify(shared);
const base = { toolbar: "Full", toolbar_Full: shared };
const editorA = Object.create(base);
const editorB = Object.create(base);
assert(add(editorA, B) === true, "shared toolbar: button added for this editor");
assert(JSON.stringify(shared) === sharedBefore, "shared toolbar array not modified");
assert(base.toolbar_Full === shared, "shared config still points at the unmodified array");
assert(
  !JSON.stringify(editorB.toolbar_Full).includes(B),
  "another editor using the same config has no Warpwire button",
);
assert(
  JSON.stringify(editorA.toolbar_Full).split(B).length === 2,
  "this editor's toolbar has the button once",
);
const sharedArray = [["Image", "ContentItem"]];
const own = { toolbar: sharedArray };
add(own, B);
assert(
  JSON.stringify(sharedArray) === '[["Image","ContentItem"]]' && own.toolbar !== sharedArray,
  "array toolbar: the original array is left unchanged",
);

if (failures) {
  console.log(`toolbar.test: FAIL (${failures})`);
  process.exit(1);
}
console.log("toolbar.test: PASS");
