// Checks the README's documented ckeditor.launch.js edits against Sakai's own
// ckeditor.launch.js (fixtures from Sakai 12.7, 22.4 and 25.2).
//
// The edits are read from the README (the code block after each
// `<!-- warpwire-edit: <name> -->` marker), applied to a fixture the way the
// README says, and the fixture's sakai.editor.launch() is run in a sandbox with
// a stub CKEDITOR. The test passes only if CKEditor would load the plugin from
// the drop-in path and enable it, with Sakai's own plugins still enabled. So if
// the README's instructions stop registering the plugin, this test fails.
//
// No browser or Sakai needed. Run: node registration.test.mjs

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const README = readFileSync(join(ROOT, "README.md"), "utf8");
const PLUGIN_PATH = "/library/editor/ckextraplugins/warpwirecontentitem/";

let failures = 0;
function assert(cond, msg) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
}

// The first code block after `<!-- warpwire-edit: name -->`, with each line
// trimmed (a block inside a list item is indented).
function edit(name) {
  const m = README.match(
    new RegExp(`<!-- warpwire-edit: ${name} -->\\s*\`\`\`[a-z]*\\n([\\s\\S]*?)\\n[ \\t]*\`\`\``),
  );
  if (!m) throw new Error(`README has no "warpwire-edit: ${name}" block`);
  return m[1].split("\n").map((l) => l.trim()).join("\n").trim();
}

// Sakai's Maven build fills in ${...} placeholders; ckeditor-extra-plugins gets
// the given value and the rest (versions, a11y/math plugin lists) are blanked,
// which doesn't affect plugin registration.
function filter(src, extraPlugins = "sakaipreview,sakaidropdowntoolbar,sakaiopenlink,") {
  return src
    .replace(/\$\{ckeditor-extra-plugins\}/g, extraPlugins)
    .replace(/\$\{[^}]+\}/g, "");
}

// Inserts `text` as a new line after the single line matching `anchor`.
function insertAfter(src, anchor, text) {
  const lines = src.split("\n");
  const at = lines.filter((l) => anchor.test(l));
  if (at.length !== 1) throw new Error(`expected one line matching ${anchor}, found ${at.length}`);
  const i = lines.findIndex((l) => anchor.test(l));
  const indent = lines[i].match(/^\s*/)[0];
  lines.splice(i + 1, 0, ...text.split("\n").map((l) => indent + l));
  return lines.join("\n");
}

// A value that tolerates any property access or call, for the browser APIs
// launch() touches (document, window, getComputedStyle, ...).
function anything() {
  const p = new Proxy(function () {}, {
    get(_t, k) {
      if (k === Symbol.toPrimitive) return () => "";
      if (k === "then" || typeof k === "symbol") return undefined;
      return p;
    },
    apply: () => p,
    construct: () => p,
  });
  return p;
}

const BROWSER = ["window", "document", "self", "navigator", "getComputedStyle", "jQuery", "$", "portal", "localStorage", "location"];

// Runs launch() and returns { paths: {plugin: path}, extraPlugins: [...] }.
function launch(src) {
  const paths = {};
  let config = null;
  const ck = {
    plugins: { addExternal: (name, path) => { paths[name] = path; } },
    replace: (_id, cfg) => { config = cfg; return anything(); },
    on() {},
    config: { specialChars: [] },
    dtd: { $removeEmpty: {} },
  };
  const globals = { CKEDITOR: new Proxy(ck, { get: (t, k) => (k in t ? t[k] : anything()) }), console };
  const context = vm.createContext(
    new Proxy(globals, {
      has: () => true,
      get(t, k) {
        if (k in t) return t[k];
        if (typeof k === "symbol") return undefined;
        if (k in globalThis) return globalThis[k];
        return BROWSER.includes(k) ? anything() : undefined;
      },
    }),
  );
  vm.runInContext(src, context);
  vm.runInContext("sakai.editor.editors.ckeditor.browser = 'elfinder'; sakai.editor.launch('t', {}, '100', '100');", context);
  if (!config) throw new Error("launch() did not call CKEDITOR.replace");
  return { paths, extraPlugins: String(config.extraPlugins).split(",").map((s) => s.trim()) };
}

function registered(label, result) {
  const ok =
    result.paths.warpwirecontentitem === PLUGIN_PATH &&
    result.extraPlugins.includes("warpwirecontentitem") &&
    result.paths.contentitem !== undefined &&
    result.extraPlugins.includes("sakaipreview");
  assert(ok, `${label}: registered at ${PLUGIN_PATH} and enabled, Sakai's plugins still enabled`);
  return ok;
}

const fixture = (v) => readFileSync(join(HERE, "fixtures", `ckeditor.launch.sakai-${v}.js`), "utf8");
const ADD_EXTERNAL_ANCHOR = /^\s*CKEDITOR\.plugins\.addExternal\(\s*'contentitem'\s*,/;
const ARRAY_ANCHOR = /^\s*'contentitem',\s*$/;
const STRING_LINE = /^(\s*)ckconfig\.extraPlugins\+="[^"]*";\s*$/m;

const addExternal = edit("addexternal");
const arrayEntry = edit("extraplugins-array");
const stringLine = edit("extraplugins-string");
const mavenProperty = edit("maven-property");

assert(
  existsSync(join(ROOT, "plugin", "webapps", ...PLUGIN_PATH.split("/").filter(Boolean), "plugin.js")),
  `the drop-in tree has plugin.js at webapps${PLUGIN_PATH}`,
);

// Sakai 22-25: extraPlugins is an array literal.
for (const v of ["22.4", "25.2"]) {
  const stock = filter(fixture(v));
  assert(!launch(stock).extraPlugins.includes("warpwirecontentitem"), `Sakai ${v} stock: plugin not enabled`);
  let src = insertAfter(stock, ADD_EXTERNAL_ANCHOR, addExternal);
  src = insertAfter(src, ARRAY_ANCHOR, arrayEntry);
  registered(`Sakai ${v} with the README's edits`, launch(src));
}

// Sakai 12-21: extraPlugins is appended as a string (deployed, i.e. filtered,
// file). The README shows the line after the edit; it replaces Sakai's line.
{
  const stock = filter(fixture("12.7"), "sakaipreview,image2,audiorecorder,contentitem,movieplayer,wordcount,notification,autosave");
  assert(STRING_LINE.test(stock), "Sakai 12.7 stock: has a ckconfig.extraPlugins+=\"...\" line");
  assert(STRING_LINE.test(stringLine), "README's Sakai 12-21 extraPlugins example is one ckconfig.extraPlugins+=\"...\" line");
  let src = insertAfter(stock, ADD_EXTERNAL_ANCHOR, addExternal);
  src = src.replace(STRING_LINE, (_m, indent) => indent + stringLine);
  registered("Sakai 12.7 with the README's edits", launch(src));
}

// Source builds: the ckeditor-extra-plugins property enables the plugin; the
// addExternal line is still needed in the source ckeditor.launch.js.
{
  const value = mavenProperty.match(/^-Dckeditor-extra-plugins=(\S+)$/)?.[1];
  assert(value !== undefined, "README's source-build example is a single -Dckeditor-extra-plugins=... option");
  const src = insertAfter(filter(fixture("25.2"), value || ""), ADD_EXTERNAL_ANCHOR, addExternal);
  registered("Sakai 25.2 source build with the README's -Dckeditor-extra-plugins", launch(src));
}

// Guard against a vacuous harness: each edit on its own is not enough.
{
  const stock = filter(fixture("25.2"));
  const pathOnly = launch(insertAfter(stock, ADD_EXTERNAL_ANCHOR, addExternal));
  assert(!pathOnly.extraPlugins.includes("warpwirecontentitem"), "control: addExternal alone does not enable the plugin");
  const enableOnly = launch(insertAfter(stock, ARRAY_ANCHOR, arrayEntry));
  assert(enableOnly.paths.warpwirecontentitem === undefined, "control: the extraPlugins entry alone does not register the path");
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll registration checks passed");
