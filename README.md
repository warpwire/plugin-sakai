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
| 12 – 23 | Expected to work; not verified for this release. The registration tool checks `ckeditor.launch.js` before changing it and refuses (changing nothing) if the file isn't in the shape it expects. |

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

## What a release contains

Each release on the [GitHub Releases page](https://github.com/warpwire/plugin-sakai/releases)
has three files:

| File | What it is |
|---|---|
| `warpwire-sakai-<version>.war` | The plugin as a standalone static webapp. Deploy it as `webapps/warpwire.war`, so it is served at `/warpwire`. |
| `warpwire-register` | The registration tool (bash). It adds, checks, and removes the plugin's one-line registration in Sakai's `ckeditor.launch.js`. |
| `SHA256SUMS` | SHA-256 checksums for both files. |

The WAR contains:

```
editor/warpwirecontentitem/   CKEditor plugin: plugin.js, lang/, html/warpwire.html, images/, index.html
scripts/warpwire.js           shared runtime: version, config accessor, diagnostics
scripts/warpwirecontentitem.js  portal renderer / playback
```

Because the plugin lives in its own webapp, replacing Sakai's own webapps (for
example during a Sakai upgrade) doesn't remove it. The one thing Sakai offers
no other hook for is registering an editor plugin, so `warpwire-register`
inserts a single marked line into `webapps/library/editor/ckeditor.launch.js`.
The plugin adds its own toolbar button, so Sakai's toolbar definition isn't
edited.

The plugin **version** is defined once, in `scripts/warpwire.js`
(`WARPWIRE.version`), and matches the release tag and the WAR's file name.
Per-deployment values (Warpwire instance domain, student-contribution
destination) live in `sakai.properties`, not in the plugin files.

## Installation

Run these steps as the user that owns the Tomcat files. `$CATALINA_BASE` is
your Tomcat base directory (the one containing `webapps/`).

### 1. Download and verify the release

Download the three files for the release from the
[Releases page](https://github.com/warpwire/plugin-sakai/releases) into one
directory, then check them:

```sh
sha256sum -c SHA256SUMS          # Linux
shasum -a 256 -c SHA256SUMS      # macOS
chmod +x warpwire-register
```

Both lines must say `OK`.

If you are upgrading from the legacy (3.0.x) plugin, first follow
[Upgrading from the legacy Warpwire plugin](#upgrading-from-the-legacy-warpwire-plugin).

### 2. Deploy the WAR

Copy the WAR into Tomcat as `warpwire.war`. The file name sets the context path
(`/warpwire`):

```sh
cp warpwire-sakai-<version>.war "$CATALINA_BASE/webapps/warpwire.war"
```

### 3. Register the editor plugin

```sh
./warpwire-register install --catalina-base "$CATALINA_BASE"
```

This inserts one line after Sakai's own `contentitem` plugin registration in
`webapps/library/editor/ckeditor.launch.js` and keeps a backup of the original
next to it (`ckeditor.launch.js.warpwire-backup`). It is safe to re-run: if the
plugin is already registered it changes nothing. If the file doesn't look as
expected (an unsupported Sakai version, or a locally customized file), it exits
with an error and changes nothing.

**Re-run `install` after every Sakai upgrade or redeploy.** Sakai replaces
`ckeditor.launch.js` when its `library` webapp is redeployed, which removes the
registration. Adding the command to your deploy or startup automation, after
Sakai's webapps are in place, keeps it applied. `status` (step 6) reports a
missing registration.

Use `--dry-run` to see the change without making it, and `--context /path` if
you deployed the WAR under a different name.

### 4. Configure Sakai (`sakai.properties`)

Add the Warpwire scripts and your per-deployment settings to every portal page
with one `portal.include.extrahead` entry. The inline `window.WARPWIRE_DEPLOY`
block must come **before** the two scripts:

```properties
portal.include.extrahead=<script>window.WARPWIRE_DEPLOY={instanceDomain:"https://[YOUR_DOMAIN].warpwire.net",contributionUri:"https://[YOUR_DOMAIN].warpwire.net",debug:false};</script><script src="/warpwire/scripts/warpwire.js"></script><script src="/warpwire/scripts/warpwirecontentitem.js"></script>
```

| Setting | Meaning |
|---|---|
| `instanceDomain` | Your Warpwire instance URL, no trailing slash. |
| `contributionUri` | Base URL for student contributions. Defaults to `instanceDomain`. |
| `toolTitle` | Text that identifies the Warpwire tool in Sakai's content-item picker, matched against the tool's title and description. Defaults to `warpwire`. Set it only if you renamed or localized the tool. |
| `debug` | `true` logs `[warpwire]` diagnostics to the browser console. You can also add `?wwdebug=1` to any page URL. |

Everything in this block is sent to browsers, so never put the LTI key or
secret here. If you already use `portal.include.extrahead` for something else,
append the Warpwire part to the same value (Sakai reads one value).

`sakai.properties` lives in `sakai.home`, outside Sakai's webapps, so this
setting survives Sakai upgrades. Sakai reads it at startup: **restart Sakai**
after changing it.

Also apply the cookie settings in [Cookies & HTTPS](#cookies--https-required-for-restricted-playback).

### 5. Register the Warpwire LTI 1.1 tool

In **Administration Workspace → External Tools → Install LTI 1.1 Tool**, create a
globally-available tool:

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

### 6. Verify the installation

```sh
./warpwire-register status --catalina-base "$CATALINA_BASE" --url https://[YOUR_SAKAI_HOST]
```

`status` checks that the editor registration is present, the plugin webapp is
deployed and its files are served, and `sakai.properties` loads the Warpwire
scripts. It prints `FAIL` for each failed check and exits non-zero if any
failed. If `sakai.properties` isn't in `$CATALINA_BASE/sakai/`, pass
`--properties /path/to/sakai.properties`.

Then check the browser side: open a page with a rich-text editor, adding
`?wwdebug=1` to the URL, hard-reload it, and confirm:

- the **Insert Warpwire Media** button is in the editor toolbar;
- the console shows `[warpwire]` lines and no "tool not found" or "instance
  domain is not configured" warning;
- the button opens the Warpwire chooser for your account.

## Upgrading to a new release

1. Download and verify the new release (step 1).
2. Replace `webapps/warpwire.war` with the new WAR (step 2). Tomcat redeploys
   `/warpwire` when the WAR changes if `autoDeploy` is on; otherwise restart Sakai.
3. Run the new release's `warpwire-register install`. It updates the
   registration line if the new release changed it.
4. Read the release notes for any configuration changes, then run `status`.

After a **Sakai** upgrade, run `warpwire-register install` again, and redeploy
`warpwire.war` if your upgrade process starts from an empty `webapps/`.

## Rolling back to a previous release

1. `./warpwire-register uninstall --catalina-base "$CATALINA_BASE"` (current release's tool).
2. Deploy the previous release's WAR as `webapps/warpwire.war`.
3. Run the previous release's `warpwire-register install`, then `status`. The
   browser console (`?wwdebug=1`) reports the active version.

This applies to releases from 3.1.0 on. To go back to the legacy 3.0.x plugin,
uninstall this one and follow that version's own instructions.

## Uninstalling

1. `./warpwire-register uninstall --catalina-base "$CATALINA_BASE"`. This
   removes the registration line. If Sakai hasn't been upgraded since install,
   `ckeditor.launch.js` is restored byte-for-byte to the backup, and the backup
   is deleted.
2. Delete `webapps/warpwire.war` (Tomcat removes the expanded `webapps/warpwire/`).
3. Remove the Warpwire part of `portal.include.extrahead` from `sakai.properties`
   and restart Sakai.
4. Optionally, remove or disable the Warpwire LTI tool (step 5). Existing
   Warpwire embeds in content stop rendering as players once the plugin is
   removed.

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

- **No Warpwire button in the editor** — run `warpwire-register status`. Common
  causes: the registration is missing (re-run `install`, especially after a Sakai
  upgrade), `warpwire.war` isn't deployed, or the browser cached the old
  `ckeditor.launch.js` (hard-reload). The button appears on Sakai's full
  editor toolbar, not the basic one shown on narrow screens.
- **`install` refuses to change `ckeditor.launch.js`** — it found a manual or
  legacy Warpwire registration, or the file isn't in the expected shape.
  Restore the original file (for example by redeploying Sakai's `library`
  webapp) and run `install` again.
- **"Warpwire tool not found / not configured"** — the LTI 1.1 tool is not
  installed, is disabled, or is *stealthed* (Tool Visibility must be Visible).
- **Restricted media shows a lock / "OAuth validation has failed"** — the LTI
  1.1 **key/secret** don't match, or cross-site cookies are blocked (see
  **Cookies & HTTPS**), or the viewer isn't entitled to the media in Warpwire.

## Upgrading from the legacy Warpwire plugin

Remove the old tool from course Tools menus first. Then remove the legacy
assets before deploying this version:

- `webapps/library/editor/ckextraplugins/warpwire` and
  `webapps/library/editor/ckextraplugins/warpwirecontentitem`;
- the legacy `webapps/portal/scripts/warpwire*.js` files and their
  `portal.include.extrahead` script tags;
- the legacy `warpwire`/`warpwirecontentitem` edits in `ckeditor.launch.js`
  (redeploying Sakai's `library` webapp restores the original file);
- any legacy `IMSBLTIPortlet.xml` / `site.vm` edits.

Restart Sakai, then install this version. Embeds created by the legacy plugin
continue to render; public legacy embeds play directly.

## Building from source

The release artifacts are built from this repository by `build.sh`:

```sh
./build.sh                  # writes dist/warpwire-sakai-<version>.war, dist/warpwire-register, dist/SHA256SUMS
```

It needs `bash`, `python3` and `git`. The build is reproducible: building a
release tag (`git checkout v<version> && ./build.sh`) produces files whose
checksums match that release's `SHA256SUMS`. The build fails if the plugin
files contain internal hostnames or credentials (`release-denylist.txt`).

Tests (no running Sakai needed) are in [`test/`](test/README.md).

## Releasing (maintainers)

The version is defined once, in `webapp/scripts/warpwire.js` (`NS.version`), and
each release is a `v<version>` tag. Record changes under `## [Unreleased]` in
[CHANGELOG.md](CHANGELOG.md) as you make them. To cut a release, on an
up-to-date `master` with a clean tree:

```sh
./publish.sh minor          # or patch / major
```

It finds the latest release tag, proposes the next version, and shows the
release notes. After you confirm, it sets `NS.version`, turns `Unreleased` into
the dated `## [<version>]` section, checks that the release builds, and creates
the commit `Release <version>` and the annotated tag. It doesn't push. Push the
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
into the WAR, the release notes come from `## [Unreleased]`, and GitHub marks it
as a pre-release. Alphas don't count as releases when the next version is
worked out, so `./publish.sh minor` after `v3.1.0-alpha.2` still releases 3.1.0.

## License

Educational Community License, Version 2.0. See [LICENSE](LICENSE).
