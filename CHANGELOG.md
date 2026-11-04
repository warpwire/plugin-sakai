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

### Install changes

The plugin installs as before: copy the `plugin/` files into Sakai (same
locations as 3.0.x) and edit `ckeditor.launch.js`, now from a clone of the
repository at the release tag or from the release zip. What changes:

- `portal.include.extrahead` now carries the configuration
  (`window.WARPWIRE_DEPLOY`) and loads `/portal/scripts/warpwire.js` before
  `warpwirecontentitem.js`. `studentContributionUri` is no longer edited into
  `plugin.js`. See "Upgrading from 3.0.x" in the README.
- No toolbar edit is needed (see below). An existing toolbar entry still works.

If you tested `v3.1.0-alpha.1`, which shipped as a standalone `warpwire.war`
with a `warpwire-register` tool: that approach is withdrawn. Remove the WAR
and its line in `ckeditor.launch.js`; see the README.

### Added

- Sakai 25 support (tested on 25.2), including Sakai 25's portal markup and
  its round-trip LTI 1.1 prelaunch redirect.
- Exact `ckeditor.launch.js` edits for Sakai 22 – 25 and Sakai 12 – 21, and
  instructions for schools that build Sakai from source. Tests check the
  documented edits against Sakai 12.7, 22.4 and 25.2's own files.
- Release files on GitHub Releases: `warpwire-sakai-<version>.zip` (the
  `plugin/` files, README and license) and `SHA256SUMS`. Builds are
  reproducible from the release tag (`./build.sh`).
- A verification checklist in the README.
- The editor plugin adds its own toolbar button, so Sakai's toolbar definition
  is no longer edited. It only adds its own button, never moves or removes
  other buttons, leaves a toolbar shared with other editors unchanged, and can
  be hidden with CKEditor's `removeButtons`.
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
