// Unit test for the return-handshake page
// (webapp/editor/warpwirecontentitem/html/warpwire.html).
//
// Serves the shipped warpwire.html from a throwaway localhost server (so the
// page has a real http origin, which its postMessage handshake targets) and
// asserts that a value containing literal "=" round-trips through the handshake
// intact and that no error is thrown. No running Sakai is required.
//
// Run: npm install && npx playwright install chromium && node warpwire-html.test.mjs
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(
  join(
    HERE,
    "..",
    "webapp",
    "editor",
    "warpwirecontentitem",
    "html",
    "warpwire.html",
  ),
  "utf8",
);

const server = createServer((_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(HTML);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

// Values deliberately contain literal "=" (base64-style padding) to prove the
// return page splits on the FIRST "=" only (no truncation).
const jsonData = "W3sidCI6ImE9YiJ9XQ==";
const pluginId = "ID==TOKEN==";
const url = `${base}/warpwire.html?jsonData=${jsonData}&pluginId=${pluginId}`;

const b = await chromium.launch({ headless: true });
const page = await b.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
// Capture the postMessage the page sends to its parent (== itself, top-level).
await page.addInitScript(() => {
  window.__received = [];
  window.addEventListener("message", (e) => window.__received.push(e.data));
});
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const got = await page.evaluate(() => window.__received);

function assert(c, m) {
  if (!c) {
    console.error("ASSERT FAIL:", m);
    process.exitCode = 1;
  } else {
    console.log("ok -", m);
  }
}
assert(
  errs.length === 0,
  `no uncaught errors (postData defined, no window.close crash) (${errs.join("; ")})`,
);
assert(got.length === 1, "exactly one deliverResult message posted");
const msg = got[0] || {};
assert(msg.message === "deliverResult", "message type is deliverResult");
assert(msg.pluginId === "ID==TOKEN==", `=-containing pluginId preserved: ${msg.pluginId}`);
assert(
  msg.result === "W3sidCI6ImE9YiJ9XQ==",
  `=-containing jsonData preserved: ${msg.result}`,
);

await b.close();
server.close();
console.log(process.exitCode ? "warpwire-html.test: FAIL" : "warpwire-html.test: PASS");
