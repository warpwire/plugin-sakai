# Warpwire Plugin for Sakai

Adds a **Warpwire** button to the Sakai rich-text (CKEditor) editor so authors can
select or upload Warpwire media and insert it into Sakai content, and renders
those embeds so they authenticate and play back for viewers — including
non-public (restricted) media.

## Supported Sakai versions

The plugin is a CKEditor 4 content-item plugin plus a portal playback script,
and it uses **LTI 1.1** (still supported in Sakai 25). It targets **Sakai 12
through Sakai 25**.

| Sakai | Status for this release |
|---|---|
| 25.2 | Verified |
| 12 – 25.1 | Expected to work; not verified for this release. The `ckeditor.launch.js` edits for these versions are checked against Sakai 12.7 and 22.4's files by the tests. |

Each release's notes list the Sakai versions it was verified against.

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

## What gets installed

The `plugin/` directory mirrors Sakai's install tree. Copy it over your Sakai
install and the files land next to Sakai's own editor plugins and portal
scripts:

```
plugin/webapps/library/editor/ckextraplugins/warpwirecontentitem/   CKEditor plugin: plugin.js, lang/, html/warpwire.html, images/, index.html
plugin/webapps/portal/scripts/warpwire.js                           shared runtime: version, configuration, diagnostics
plugin/webapps/portal/scripts/warpwirecontentitem.js                portal renderer / playback
```

Then you make three edits: two lines in Sakai's `ckeditor.launch.js` and one
`portal.include.extrahead` entry in `sakai.properties`. You don't edit the
toolbar: the plugin adds its own button (see [Toolbar](#toolbar)).

The plugin **version** is defined once, in `portal/scripts/warpwire.js`
(`WARPWIRE.version`), and matches the release tag. Per-deployment values
(Warpwire instance domain, student-contribution destination) live in
`sakai.properties`, not in the plugin files.

If you're upgrading from the 3.0.x plugin, the files go in the same places and
the `ckeditor.launch.js` edits are the same lines; see
[Upgrading from 3.0.x](#upgrading-from-30x).

## Installation

`$CATALINA_BASE` is your Tomcat base directory (the one containing `webapps/`).
If you build Sakai from source, see [Sakai built from source](#sakai-built-from-source)
instead of steps 2 and 3.

### 1. Get the files

Either clone the repository at a release tag:

```sh
git clone --branch v<version> https://github.com/warpwire/plugin-sakai.git
cd plugin-sakai
```

or download `warpwire-sakai-<version>.zip` and `SHA256SUMS` from the
[Releases page](https://github.com/warpwire/plugin-sakai/releases), check the
zip, and unzip it:

```sh
sha256sum -c SHA256SUMS          # Linux; on macOS: shasum -a 256 -c SHA256SUMS
unzip warpwire-sakai-<version>.zip
cd warpwire-sakai-<version>
```

Both give you the same `plugin/` directory.

### 2. Copy the files into Sakai

```sh
cp -R plugin/webapps/. "$CATALINA_BASE/webapps/"
```

This adds `library/editor/ckextraplugins/warpwirecontentitem/` and the two
`portal/scripts/warpwire*.js` files. It changes no Sakai file.

### 3. Edit `ckeditor.launch.js`

Open `$CATALINA_BASE/webapps/library/editor/ckeditor.launch.js` and make two
edits.

**a. Register the plugin.** Add this line directly after Sakai's
`CKEDITOR.plugins.addExternal('contentitem',basePath+'contentitem/', 'plugin.js');`
line:

<!-- warpwire-edit: addexternal -->
```js
CKEDITOR.plugins.addExternal('warpwirecontentitem',basePath+'warpwirecontentitem/', 'plugin.js');
```

**b. Enable it.** How depends on your Sakai version.

*Sakai 22 – 25:* `extraPlugins` is a list. Add this entry directly after the
`'contentitem',` entry in the `extraPlugins: [ ... ]` list:

<!-- warpwire-edit: extraplugins-array -->
```js
'warpwirecontentitem',
```

*Sakai 12 – 21:* find the line that starts `ckconfig.extraPlugins+="` and add
`warpwirecontentitem,` at the start of the quoted list. For example, Sakai 12's
line becomes:

<!-- warpwire-edit: extraplugins-string -->
```js
ckconfig.extraPlugins+="warpwirecontentitem,sakaipreview,image2,audiorecorder,contentitem,movieplayer,wordcount,notification,autosave";
```

If your `ckeditor.launch.js` is already customized, make the same two changes
wherever your version registers and enables plugins.

### 4. Configure Sakai (`sakai.properties`)

Add the Warpwire scripts and your per-deployment settings to every portal page
with one `portal.include.extrahead` entry. The inline `window.WARPWIRE_DEPLOY`
block must come **before** the two scripts:

```properties
portal.include.extrahead=<script>window.WARPWIRE_DEPLOY={instanceDomain:"https://[YOUR_DOMAIN].warpwire.net",contributionUri:"https://[YOUR_DOMAIN].warpwire.net",debug:false};</script><script src="/portal/scripts/warpwire.js"></script><script src="/portal/scripts/warpwirecontentitem.js"></script>
```

| Setting | Meaning |
|---|---|
| `instanceDomain` | Your Warpwire instance URL, no trailing slash. |
| `contributionUri` | Base URL for student contributions. Defaults to `instanceDomain`. |
| `toolTitle` | Text that identifies the Warpwire tool in Sakai's content-item picker, matched against the tool's title and description. Defaults to `warpwire`. Set it only if you renamed or localized the tool. |
| `maintainerRoles` | Site roles that add Warpwire media from the editor. Everyone else gets the student-contribution flow. A list or comma-separated string of Sakai role ids, case-insensitive. Defaults to `["maintain","Instructor"]`. |
| `debug` | `true` logs `[warpwire]` diagnostics to the browser console. You can also add `?wwdebug=1` to any page URL. |

Everything in this block is sent to browsers, so never put the LTI key or
secret here. If you already use `portal.include.extrahead` for something else,
append the Warpwire part to the same value (Sakai reads one value).

Also apply the cookie settings in [Cookies & HTTPS](#cookies--https-required-for-restricted-playback).

### 5. Register the Warpwire LTI 1.1 tool

**If you are upgrading, keep your existing Warpwire LTI 1.1 tool.** Don't
delete it or create a second one: existing embeds are tied to that tool's
internal id and stop working if it is deleted. Instead, open it in
**Administration Workspace → External Tools → Edit** and check that it matches
the table below, in particular **Enabled**, **Visible** (not stealthed),
**use from the rich content editor**, and LTI 1.3 off.

On a fresh install, in **Administration Workspace → External Tools → Install LTI
1.1 Tool**, create a globally-available tool:

| Setting | Value |
|---|---|
| Site Id | *leave blank* (available in all sites) |
| Tool Title / Button Text | `Warpwire` (may be renamed/translated — discovery doesn't depend on the label) |
| Tool Status | **Enabled** |
| Tool Visibility | **Visible** *(not stealthed — a stealthed tool is hidden from the editor picker)* |
| Launch URL | `https://[YOUR_DOMAIN].warpwire.net/api/ltix/` *(note the `x` and trailing slash)* |
| Launch Key / Secret | provided by Warpwire |
| Privacy | send user names **and** email addresses |
| Services | allow return grades, provide roster, allow store settings |
| Content-Item launches | allow **launch as a link**, **configure itself (content-item)**, and **use from the rich content editor to select content** |
| SHA-256 signature | sign launch with SHA-256 |
| LTI 1.3 support | Tool does **not** support LTI 1.3 |

### 6. Restart Sakai and verify

Sakai reads `sakai.properties` at startup, so restart Sakai. Then check, with
`https://[YOUR_SAKAI_HOST]` as your Sakai URL:

1. **The files are served.** Each of these returns `200`:
   ```sh
   for f in library/editor/ckextraplugins/warpwirecontentitem/plugin.js portal/scripts/warpwire.js portal/scripts/warpwirecontentitem.js; do
     curl -s -o /dev/null -w "%{http_code}  $f\n" "https://[YOUR_SAKAI_HOST]/$f"
   done
   ```
2. **The editor registration is live.** This prints your two edits:
   ```sh
   curl -s https://[YOUR_SAKAI_HOST]/library/editor/ckeditor.launch.js | grep -n warpwirecontentitem
   ```
3. **The configuration is loaded.** The page source of any portal page contains
   `window.WARPWIRE_DEPLOY` and the two `/portal/scripts/warpwire*.js` script tags.
4. **In the browser.** Open a page with a rich-text editor, add `?wwdebug=1` to
   the URL, and hard-reload it (so the browser fetches the edited
   `ckeditor.launch.js`). Then:
   - the **Insert Warpwire Media** button is in the editor toolbar;
   - typing `WARPWIRE.version` in the browser console prints this release's version;
   - the console shows `[warpwire]` lines and no "tool not found" or "instance
     domain is not configured" warning;
   - the button opens the Warpwire chooser for your account.

If a check fails, see [Troubleshooting](#troubleshooting).

## Sakai built from source

If you build and deploy Sakai yourself, put the plugin in your Sakai source
tree so every build includes it, and it survives Sakai upgrades and redeploys:

1. Copy the files into the source tree:
   ```sh
   cp -R plugin/webapps/library/editor/ckextraplugins/warpwirecontentitem <sakai-src>/library/src/webapp/editor/ckextraplugins/
   cp plugin/webapps/portal/scripts/warpwire*.js <sakai-src>/portal/portal-charon/charon/src/webapp/scripts/
   ```
2. Make the step 3 edits in `<sakai-src>/library/src/webapp-filtered/editor/ckeditor.launch.js`.
   For edit **b**, you can instead add the plugin to the `ckeditor-extra-plugins`
   build property. Overriding the property replaces Sakai's default list, so
   copy your version's default from `library/pom.xml` and add
   `warpwirecontentitem,` to it. For Sakai 25:

   <!-- warpwire-edit: maven-property -->
   ```sh
   -Dckeditor-extra-plugins=sakaipreview,sakaidropdowntoolbar,sakaiopenlink,warpwirecontentitem,
   ```
3. Do steps 4 – 6 as above.

## Toolbar

The plugin puts its **Insert Warpwire Media** button on the editor toolbar
itself, so you don't edit the toolbar definition. It only adds its own button:

- directly before Sakai's content-item button, or in its own group after the
  media buttons when there is no content-item button;
- never removing, renaming or reordering any other button;
- not at all if the toolbar already has the button. To choose its position
  yourself, add `'WarpwireContentItem'` to your toolbar definition (for example
  `toolbar_Full`) wherever you want it;
- not on toolbars without a media slot, such as Sakai's Basic toolbar (shown
  on narrow screens).

To hide the button, add `WarpwireContentItem` to CKEditor's standard
`removeButtons` setting in `ckeditor.launch.js`.

## Upgrading to a new release

1. Get the new release's files (step 1).
2. Copy them over the old ones (step 2), or into your source tree.
3. Read the release notes for any change to the `ckeditor.launch.js` edits or
   the configuration. Usually there is none.
4. Hard-reload the browser and run the checks in step 6.

**After a Sakai upgrade or a redeploy of Sakai's `library` or `portal` webapp,
copy the files and make the `ckeditor.launch.js` edits again.** Sakai replaces
those webapps, which removes both. `sakai.properties` is not affected. Schools
that build from source (see [Sakai built from source](#sakai-built-from-source))
avoid this.

## Rolling back to a previous release

Copy the previous release's `plugin/` files over the current ones (from its tag
or its zip), then hard-reload the browser. The `ckeditor.launch.js` edits stay
the same unless that release's notes say otherwise. `WARPWIRE.version` in the
browser console shows the active version.

This applies to releases from 3.1.0 on. To go back to the 3.0.x plugin, follow
that version's own instructions.

## Uninstalling

1. Remove the two `ckeditor.launch.js` edits (step 3).
2. Delete `webapps/library/editor/ckextraplugins/warpwirecontentitem/`,
   `webapps/portal/scripts/warpwire.js` and
   `webapps/portal/scripts/warpwirecontentitem.js`.
3. Remove the Warpwire part of `portal.include.extrahead` from `sakai.properties`
   and restart Sakai.
4. Optionally, disable the Warpwire LTI tool (step 5). Disable it rather than
   delete it if you might reinstall: deleting it permanently breaks existing
   embeds, because they are tied to the tool's internal id. Existing Warpwire
   embeds in content stop rendering as players once the plugin is removed.

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

- **No Warpwire button in the editor** — run the step 6 checks. Common causes:
  the `ckeditor.launch.js` edits are missing (often after a Sakai upgrade), the
  files aren't in `webapps/library/editor/ckextraplugins/warpwirecontentitem/`,
  or the browser cached the old `ckeditor.launch.js` (hard-reload). The button
  appears on Sakai's full editor toolbar, not the basic one shown on narrow
  screens.
- **The editor doesn't load at all** after the edits — a typo in
  `ckeditor.launch.js`. The browser console shows the JavaScript error and its
  line. Compare your edits with step 3.
- **`WARPWIRE` is not defined in the console** — the `portal.include.extrahead`
  entry is missing or Sakai wasn't restarted after adding it.
- **"Warpwire tool not found / not configured"** — the LTI 1.1 tool is not
  installed, is disabled, or is *stealthed* (Tool Visibility must be Visible).
- **Restricted media shows a lock / "OAuth validation has failed"** — the LTI
  1.1 **key/secret** don't match, or cross-site cookies are blocked (see
  **Cookies & HTTPS**), or the viewer isn't entitled to the media in Warpwire.

## Upgrading from 3.0.x

3.0.x used the same file locations and the same `ckeditor.launch.js` lines, so:

1. Copy the new files over the old ones (steps 1 – 2).
2. Keep your `ckeditor.launch.js` edits. The old toolbar entry
   (`'WarpwireContentItem'` in `toolbar_Full`) can stay; the plugin won't add a
   second button.
3. Replace your Warpwire `portal.include.extrahead` entry with the step 4 one.
   Your instance domain moves from `studentContributionUri` in the old
   `plugin.js` into `WARPWIRE_DEPLOY`, and the new `warpwire.js` script tag
   must come before `warpwirecontentitem.js`.
4. Keep your Warpwire LTI 1.1 tool (step 5), restart Sakai, and verify (step 6).

Embeds inserted with 3.0.x keep playing. Embeds from the pre-3.0 plugin still
render: public ones play directly, and restricted ones need to be inserted again
from the editor (Warpwire button) before they can authenticate.

**From the pre-3.0 plugin** (the `warpwire` plugin and the `sakai.warpwire` tool):
remove the old tool from course Tools menus first, then remove
`webapps/library/editor/ckextraplugins/warpwire`, `webapps/portal/scripts/warpwire.js`
and its `site.vm` script tag, the old `warpwire` lines in `ckeditor.launch.js`,
and the `sakai.warpwire` entries in `IMSBLTIPortlet.xml`. Keep the Warpwire
LTI 1.1 External Tool. Then install this version.

**From `v3.1.0-alpha.1`** (the test release that shipped as `warpwire.war`):
delete `webapps/warpwire.war` and remove the line ending in
`// warpwire-sakai-register` from `ckeditor.launch.js`, then install this
version. Change the script paths in `portal.include.extrahead` from
`/warpwire/scripts/` to `/portal/scripts/`.

## Building a release

`build.sh` packages the `plugin/` directory as a release:

```sh
./build.sh                  # writes dist/warpwire-sakai-<version>.zip and dist/SHA256SUMS
```

The zip holds `warpwire-sakai-<version>/` with `plugin/`, `README.md` and
`LICENSE`. It needs `bash`, `python3` and `git`. The build is reproducible:
building a release tag (`git checkout v<version> && ./build.sh`) produces a zip
whose checksum matches that release's `SHA256SUMS`, and its `plugin/` files
match the tag's. The build fails if the plugin files contain internal hostnames
or credentials (`release-denylist.txt`).

Tests (no running Sakai needed) are in [`test/`](test/README.md).

## Releasing (maintainers)

The version is defined once, in `plugin/webapps/portal/scripts/warpwire.js`
(`NS.version`), and each release is a `v<version>` tag. Record changes under
`## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) as you make them. To cut a
release, on an up-to-date `master` with a clean tree:

```sh
./publish.sh minor          # or patch / major
```

It finds the latest release tag, proposes the next version, and shows the
release notes. After you confirm, it sets `NS.version`, turns `Unreleased` into
the dated `## [<version>]` section, checks that the release builds, and creates
the commit `<version>` and the annotated tag. It doesn't push. Push the
commit and tag together:

```sh
git push --atomic origin master v<version>
```

Pushing the tag runs the CI release, which publishes the build to GitHub
Releases once the repository mirror has the tag. A CI build of a final tag fails
if the tag doesn't match `NS.version`.

For an alpha, add `--alpha` (`./publish.sh minor --alpha`). It tags the current
commit as the next version plus `-alpha.N` (`v3.1.0-alpha.1`, then
`-alpha.2`, ...) without changing any files: the build stamps the alpha version
into the zip's `warpwire.js` (a checkout of the alpha tag reports the source
version), the release notes come from `## [Unreleased]`, and GitHub marks it
as a pre-release. Alphas don't count as releases when the next version is
worked out, so `./publish.sh minor` after `v3.1.0-alpha.2` still releases 3.1.0.

## License

Educational Community License, Version 2.0. See [LICENSE](LICENSE).
