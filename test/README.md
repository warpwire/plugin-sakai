# Warpwire Sakai plugin — tests

Browser-based unit tests for the plugin's client-side JavaScript. They exercise
the shipped source directly (no build step) in a headless Chromium via
[Playwright](https://playwright.dev/), and **do not require a running Sakai**.

## What's covered

- **`renderer.test.mjs`** — the portal renderer
  (`plugin/webapps/portal/scripts/warpwire.js` + `warpwirecontentitem.js`).
  Asserts each embed kind renders correctly: content-item launch embeds, legacy
  `_ww_src` embeds (including the `addUrlArgument` URL fix), malformed data
  degrading to a safe placeholder, and content-item embeds whose `<img>` was
  stripped or de-classed still rendering as a launch.
  _Note: pulls jQuery from a CDN, so this test needs network access._
- **`warpwire-html.test.mjs`** — the return-handshake page
  (`plugin/webapps/library/editor/ckextraplugins/warpwirecontentitem/html/warpwire.html`). Serves it from a throwaway
  localhost server and asserts a value containing a literal `=` round-trips
  through the `postMessage` handshake intact, with no error thrown. Fully
  self-contained.
- **`toolbar.test.mjs`** — the editor plugin's own toolbar placement. Asserts
  the button is the only change (other plugins' items keep their row and
  order), a toolbar shared with other configs is left unchanged, an existing
  entry isn't duplicated, and Basic / `toolbarGroups` toolbars are untouched.
  No browser needed.
- **`registration.test.mjs`** — the README's `ckeditor.launch.js` edits. Reads
  each edit from the README (the code block after a `<!-- warpwire-edit: ... -->`
  marker), applies it to Sakai's own `ckeditor.launch.js` from Sakai 12.7, 22.4
  and 25.2 (`fixtures/`), runs that file's `sakai.editor.launch()` with a stub
  CKEditor, and checks the plugin is registered from the drop-in path and
  enabled. If you change those README blocks, this test checks the new
  instructions still work. No browser needed.

## Run

```sh
npm install
npx playwright install chromium   # one-time: download the browser
npm test                          # runs all four; exits non-zero on failure
```

Run individually with `npm run test:renderer`, `test:html`, `test:toolbar` or
`test:registration`.

## Notes

- `fixtures/ckeditor.launch.sakai-*.js` are unmodified copies of Sakai's
  `library/src/webapp-filtered/editor/ckeditor.launch.js` at those tags
  (Educational Community License 2.0, like this plugin).
- These test the plugin JS in isolation. End-to-end verification against a live
  Sakai 25 instance (author → insert → view → play) lives in the separate
  development-environment repository, not here.
