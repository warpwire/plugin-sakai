// Unit test for the portal renderer (plugin/webapps/portal/scripts/*.js).
//
// Loads the shipped warpwire.js + warpwirecontentitem.js into a headless page
// over a synthetic DOM and asserts each embed kind renders correctly. No running
// Sakai is required. (jQuery is pulled from a CDN, so this test needs network.)
//
// Run: npm install && npx playwright install chromium && node renderer.test.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, "..", "plugin", "webapps", "portal", "scripts");
const runtime = readFileSync(join(SCRIPTS, "warpwire.js"), "utf8");
const portal = readFileSync(join(SCRIPTS, "warpwirecontentitem.js"), "utf8");

const html = `<!doctype html><html><head><meta charset=utf8>
<script>window.WARPWIRE_DEPLOY={instanceDomain:"https://ex.warpwire.net",debug:true};</script>
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
</head><body>
<!-- content-item (new) embed: restricted/public both use the launch url -->
<span class="_ww_iframe_embed" rel="https://ex.warpwire.net/api/ltix/launch?content=42">
  <img class="lti-content-item-iframe-launch" width="800" height="450" alt="My Lecture" src="thumb.png">
</span>
<!-- legacy public embed: direct src, JSON-in-rel; src already HAS a query string + an =-value -->
<span class="_ww_iframe_embed" rel='{"_ww_src":"https://ex.warpwire.net/w/AbCd/?token=a=b&x=1","_ww_width":"320","_ww_height":"180"}'>
  <img class="_ww_img" alt="Legacy Clip" width="320" height="180" src="thumb2.png">
</span>
<!-- malformed legacy embed: invalid JSON -> must degrade, not throw -->
<span class="_ww_iframe_embed" rel='{not valid json'>
  <img class="_ww_img" alt="Broken" src="thumb3.png">
</span>
<!-- content-item embed whose <img> was stripped (empty span) -> must still render a launch -->
<span class="_ww_iframe_embed" rel="https://ex.warpwire.net/access/lti/site/S/content:7" style="width:512px; height:288px;"></span>
<!-- content-item embed whose <img> lost its lti class -> must still render a launch -->
<span class="_ww_iframe_embed" rel="/access/lti/site/S/content:8">
  <img alt="Declassed" width="400" height="225" src="thumb4.png">
</span>
<p id="sentinel">page still intact</p>
</body></html>`;

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext();
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.setContent(html, { waitUntil: "networkidle" });
// Inject the runtime then the portal script (order matters). setContent already
// fired DOMContentLoaded, so the portal script's $(document).ready runs now.
await page.addScriptTag({ content: runtime });
await page.addScriptTag({ content: portal });
await page.waitForTimeout(300);

const r = await page.evaluate(() => {
  const spans = [...document.querySelectorAll("span._ww_iframe_embed")];
  const ci = spans[0].querySelector("iframe");
  const legacy = spans[1].querySelector("iframe");
  const broken = spans[2];
  const noimg = spans[3].querySelector("iframe");
  const declassed = spans[4].querySelector("iframe");
  const dim = (el) =>
    el && [el.getAttribute("width"), el.getAttribute("height")].join("x");
  return {
    version: window.WARPWIRE.version,
    ci_src: ci && ci.getAttribute("src"),
    ci_wh: dim(ci),
    ci_allow: ci && ci.getAttribute("allow"),
    legacy_src: legacy && legacy.getAttribute("src"),
    legacy_wh: dim(legacy),
    broken_has_iframe: !!broken.querySelector("iframe"),
    broken_text: broken.innerText.trim(),
    noimg_src: noimg && noimg.getAttribute("src"),
    noimg_wh: dim(noimg),
    noimg_text: spans[3].innerText.trim(),
    declassed_src: declassed && declassed.getAttribute("src"),
    declassed_wh: dim(declassed),
    declassed_text: spans[4].innerText.trim(),
    sentinel: document.getElementById("sentinel")?.innerText,
  };
});

function assert(c, m) {
  if (!c) {
    console.error("ASSERT FAIL:", m);
    process.exitCode = 1;
  } else {
    console.log("ok -", m);
  }
}
assert(errs.length === 0, `no uncaught page errors (${errs.join("; ")})`);
assert(r.version === "3.1.0", "single-source version exposed");
assert(
  r.ci_src === "https://ex.warpwire.net/api/ltix/launch?content=42",
  "content-item iframe src = launch url",
);
assert(r.ci_wh === "800x450", "content-item preserves width/height");
assert(/autoplay/.test(r.ci_allow || ""), "content-item has allow attr");
// URL fix: existing query string preserved, no double-?, =-value intact, co=sakai added
assert(
  r.legacy_src && !/\?\S*\?/.test(r.legacy_src),
  "no double question mark in legacy src",
);
assert(
  /token=a%3Db|token=a=b/.test(r.legacy_src || ""),
  "=-value in token preserved (encoded or raw)",
);
assert(/[?&]x=1(&|$)/.test(r.legacy_src || ""), "existing x=1 param preserved");
assert(/[?&]co=sakai(&|$)/.test(r.legacy_src || ""), "co=sakai appended");
assert(r.legacy_wh === "320x180", "legacy preserves width/height");
assert(r.broken_has_iframe === false, "malformed embed does not render an iframe");
assert(/unavailable/i.test(r.broken_text), "malformed embed shows safe placeholder");
// content-item span with NO img still renders a launch (not a placeholder)
assert(
  r.noimg_src === "https://ex.warpwire.net/access/lti/site/S/content:7",
  "img-less content-item span renders launch iframe",
);
assert(r.noimg_wh === "512x288", "img-less content-item sized from span style");
assert(
  !/unavailable/i.test(r.noimg_text),
  "img-less content-item does NOT degrade to placeholder",
);
// content-item span whose img lost its lti class still renders as a launch
assert(
  r.declassed_src === "/access/lti/site/S/content:8",
  "declassed-img content-item renders launch iframe",
);
assert(
  r.declassed_wh === "400x225",
  "declassed-img content-item preserves img width/height",
);
assert(
  !/unavailable/i.test(r.declassed_text),
  "declassed-img content-item does NOT degrade to placeholder",
);
assert(r.sentinel === "page still intact", "surrounding page not broken");

await b.close();
console.log(process.exitCode ? "renderer.test: FAIL" : "renderer.test: PASS");
