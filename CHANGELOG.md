# Changelog

All notable changes to the Warpwire Sakai plugin. Versions follow
[semantic versioning](https://semver.org/). Each release's section here is
published as its release notes on GitHub.

Add changes under `## [Unreleased]` as you make them. To release, run
`./publish.sh patch|minor|major` on `master`: it picks the next version, turns
`Unreleased` into the dated version section, and creates the release commit and
tag for you to push. `./publish.sh minor --alpha` tags an alpha
(`v3.1.0-alpha.1`) whose release notes are the `Unreleased` section.

## [Unreleased]

Verified against: Sakai 25.2.

### Breaking: new install

The plugin now ships as a standalone webapp plus a registration tool, instead of
files copied into Sakai's `library` and `portal` webapps with manual edits to
`ckeditor.launch.js`. Remove the legacy install first; see "Upgrading from the
legacy Warpwire plugin" in the README.

### Added

- Sakai 25 support (tested on 25.2), including Sakai 25's portal markup and
  its round-trip LTI 1.1 prelaunch redirect.
- Release artifacts: `warpwire-sakai-<version>.war` (deploy as
  `webapps/warpwire.war`), the `warpwire-register` tool, and `SHA256SUMS`.
  Builds are reproducible from the release tag (`./build.sh`).
- `warpwire-register install | uninstall | status`: adds the plugin's one-line
  registration to `ckeditor.launch.js`. It is idempotent, changes nothing if
  the file isn't in the expected shape, and uninstall restores the file
  exactly. `status` checks the whole installation.
- The editor plugin adds its own toolbar button, so Sakai's toolbar definition
  is no longer edited.
- Per-deployment configuration (`window.WARPWIRE_DEPLOY`) in
  `sakai.properties`, set once and kept across upgrades. Debug diagnostics via
  `debug: true` or `?wwdebug=1`.
- An explicit message when the Warpwire LTI tool isn't configured.

### Changed

- Restricted media authenticates through each embed's own LTI 1.1 content-item
  launch. The hidden login iframe and portal-navigation scraping are gone.
- The Warpwire tool and the user's role are detected from stable Sakai signals
  instead of matching display text, so renamed or translated tool labels work.
- The version is defined once and reported correctly in the launch context
  (was `sakai_undefined`).

### Fixed

- Instructors in course sites are recognized as site maintainers. Previously
  only the `maintain` role was, so an instructor could get the student
  contribution flow. The plugin now accepts the configurable `maintainerRoles`
  (default `maintain`, `Instructor`).
- URLs that already contain a query string, and parameter values containing
  `=`, are no longer corrupted.
- Removed dead code and leaking event listeners; failures on the main paths
  are reported instead of silently swallowed.

## [3.0.4] - 2024-05-16

### Fixed

- Adding Warpwire media from the student role.
