# Warpwire Sakai plugin — tests

Browser-based unit tests for the plugin's client-side JavaScript. They exercise
the shipped source directly (no build step) in a headless Chromium via
[Playwright](https://playwright.dev/), and **do not require a running Sakai**.

## What's covered

- **`renderer.test.mjs`** — the portal renderer
  (`webapp/scripts/warpwire.js` + `warpwirecontentitem.js`).
  Asserts each embed kind renders correctly: content-item launch embeds, legacy
  `_ww_src` embeds (including the `addUrlArgument` URL fix), malformed data
  degrading to a safe placeholder, and content-item embeds whose `<img>` was
  stripped or de-classed still rendering as a launch.
  _Note: pulls jQuery from a CDN, so this test needs network access._
- **`warpwire-html.test.mjs`** — the return-handshake page
  (`webapp/editor/warpwirecontentitem/html/warpwire.html`). Serves it from a throwaway
  localhost server and asserts a value containing a literal `=` round-trips
  through the `postMessage` handshake intact, with no error thrown. Fully
  self-contained.

## Run

```sh
npm install
npx playwright install chromium   # one-time: download the browser
npm test                          # runs both; exits non-zero on failure
```

Run individually with `npm run test:renderer` or `npm run test:html`.

## Notes

- These test the plugin JS in isolation. End-to-end verification against a live
  Sakai 25 instance (author → insert → view → play) lives in the separate
  development-environment repository, not here.
