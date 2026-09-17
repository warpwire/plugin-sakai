# Warpwire Plugin for Sakai

Adds a **Warpwire** button to the Sakai rich-text (CKEditor) editor so authors can
select or upload Warpwire media and insert it into Sakai content, and renders
those embeds so they authenticate and play back for viewers — including
non-public (restricted) media.

## Supported Sakai versions

This plugin supports **Sakai 12 through Sakai 25** (the current release line).
It is a CKEditor 4 content-item plugin plus a portal playback script, and it
uses **LTI 1.1** (still supported in Sakai 25).

> Earlier Sakai lines (10/11) are covered by our older projects. Sakai 25 support
> (and the modernization away from DOM/text scraping and the hidden-login-iframe
> auth scheme) landed in the 3.1.x line.

## How it works

- **Author flow** — the Warpwire toolbar button opens Sakai's content-item
  picker, launches (LTI 1.1) into the author's Warpwire account, and lets them
  select or upload media. The selection is inserted as a self-authenticating
  content-item embed.
- **Viewer flow** — the portal script renders each embed. Restricted media is
  served through its own LTI 1.1 content-item launch (it authenticates itself);
  public media renders directly with no session. There is **no** hidden
  login-iframe priming and **no** portal-navigation scraping.
- **Student contribution** — non-maintainers are routed to the configured
  Warpwire contribution destination (`/p/checkGroup/`) instead of the maintainer
  launch, and the returned selection is inserted after an origin- and
  token-validated handshake.

## Components

```
plugin/webapps/
  library/editor/ckextraplugins/warpwirecontentitem/   CKEditor content-item plugin
    plugin.js, lang/en.js, html/warpwire.html, images/, index.html
  portal/scripts/
    warpwire.js               shared runtime: version + config accessor + diagnostics
    warpwirecontentitem.js    portal renderer / playback
```

The plugin **version** is defined once, in `portal/scripts/warpwire.js`
(`WARPWIRE.version`). Per-deployment values (Warpwire instance domain,
student-contribution destination) are provided at deploy time as a
`window.WARPWIRE_DEPLOY` object (see **Configuration**) — they are **not**
hand-edited into source, so they survive plugin upgrades.

## Installation

Installation has three parts: deploy the plugin assets, register them with the
editor and portal, and register the Warpwire LTI 1.1 tool in Sakai.

### 1. Deploy the plugin assets

Copy the contents of `plugin/` into the corresponding locations under your
deployed Sakai webapps (`.../webapps/library/editor/ckextraplugins/...` and
`.../webapps/portal/scripts/...`). If you build Sakai from source, add the
plugin as part of your overlay/build so the assets are (re)deployed on each
build rather than lost on upgrade.

### 2. Register the editor button and portal script

- **Editor:** register `warpwirecontentitem` in the deployed
  `webapps/library/editor/ckeditor.launch.js` (the `addExternal` call, the
  `extraPlugins` list, and the toolbar's content-item group). Because
  `ckeditor.launch.js` is generated from the CKEditor artifact and is rewritten
  by Sakai upgrades, apply this registration as part of your deploy/startup
  automation rather than a one-time hand edit.
- **Portal:** inject the Warpwire scripts on every portal page via
  `sakai.properties`, in dependency order:

  ```properties
  portal.include.extrahead=<script src="/portal/scripts/warpwire-deploy.js"></script><script src="/portal/scripts/warpwire.js"></script><script src="/portal/scripts/warpwirecontentitem.js"></script>
  ```

### 3. Register the Warpwire LTI 1.1 tool

In **Administration Workspace → External Tools → Install LTI 1.1 Tool**, create a
globally-available tool:

| Setting | Value |
|---|---|
| Site Id | *leave blank* (available in all sites) |
| Tool Title / Button Text | `Warpwire` (may be renamed/translated — discovery no longer depends on the label) |
| Tool Status | **Enabled** |
| Tool Visibility | **Visible** *(not stealthed — a stealthed tool is hidden from the editor picker)* |
| Launch URL | `https://[YOUR_DOMAIN].warpwire.net/api/ltix/` *(note the `x` and trailing slash)* |
| Launch Key / Secret | provided by Warpwire |
| Privacy | send user names **and** email addresses |
| Services | allow return grades, provide roster, allow store settings |
| Content-Item launches | allow **launch as a link**, **configure itself (content-item)**, and **use from the rich content editor to select content** |
| SHA-256 signature | sign launch with SHA-256 |
| LTI 1.3 support | Tool does **not** support LTI 1.3 |

## Configuration

Provide per-deployment values as `window.WARPWIRE_DEPLOY`, loaded (via
`portal.include.extrahead`) **before** `warpwire.js`:

```html
<script>
window.WARPWIRE_DEPLOY = {
  instanceDomain: "https://[YOUR_DOMAIN].warpwire.net",  // your Warpwire instance
  contributionUri: "https://[YOUR_DOMAIN].warpwire.net", // student-contribution base (defaults to instanceDomain)
  cookieSameSite: "none",                                 // see "Cookies & HTTPS"
  debug: false                                            // set true (or use ?wwdebug=1) for console diagnostics
};
</script>
```

`instanceDomain` and the version are the single sources of truth consumed by
both the editor plugin and the portal script.

## Cookies & HTTPS (required for restricted playback)

Restricted media plays inside a cross-site iframe, so the Sakai session cookie
must be sent in that third-party context. Configure Sakai and serve it over
HTTPS so cookies are issued `SameSite=None; Secure`:

```properties
sakai.cookieSameSite=none
force.url.secure=443
```

Without `SameSite=None; Secure` over HTTPS, browsers drop the cross-site cookie
and restricted media will fail to authenticate (a lock/`OAuth`/permission error
in the embed). Public media is unaffected.

## Troubleshooting

Turn on diagnostics with `debug: true` (or append `?wwdebug=1` to a page URL) and
watch the browser console for `[warpwire]` messages. Common cases:

- **"Warpwire tool not found / not configured"** — the LTI 1.1 tool is not
  installed, is disabled, or is *stealthed* (Tool Visibility must be Visible).
- **Restricted media shows a lock / "OAuth validation has failed"** — the LTI
  1.1 **key/secret** don't match, or cross-site cookies are blocked (see
  **Cookies & HTTPS**), or the viewer isn't entitled to the media in Warpwire.

## Upgrading from the legacy Warpwire plugin

Remove the old tool from course Tools menus first, then remove the legacy assets
(`.../ckextraplugins/warpwire`, the old `portal/scripts/warpwire.js` script tag,
and any legacy `IMSBLTIPortlet.xml` / `site.vm` edits) before deploying this
version. Restart Sakai. Embeds created by the legacy plugin continue to render;
public legacy embeds play directly, and a separate one-time migration upgrades
restricted legacy embeds to the current self-authenticating format.
