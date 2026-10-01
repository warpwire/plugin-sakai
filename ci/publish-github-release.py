#!/usr/bin/env python3
"""Publish a built release (dist/) to GitHub Releases.

Run by the CI release job for a version tag (v<semver>). It:

  1. checks dist/SHA256SUMS against the built files;
  2. takes the release notes from CHANGELOG.md (the "## [<version>]" section,
     which publish.sh dates; a pre-release falls back to "## [Unreleased]");
  3. waits until the tag has been mirrored to GitHub and points at the same
     commit CI built (fails if it points elsewhere, or doesn't arrive in time);
  4. creates a draft release, uploads the WAR, the registration tool, the
     README and SHA256SUMS, then publishes it. A pre-release version (3.1.0-rc.1) is
     published as a GitHub pre-release.

It never overwrites a published release. A draft left behind by a failed run
for the same tag is deleted and recreated.

Environment:
  GITHUB_TOKEN          token with Contents read/write on GITHUB_REPO only
  GITHUB_REPO           owner/name (default: warpwire/plugin-sakai)
  CI_COMMIT_TAG         the tag being released, e.g. v3.1.0
  CI_COMMIT_SHA         the commit CI built
  MIRROR_WAIT_SECONDS   how long to wait for the mirrored tag (default: 900)
  GITHUB_API_URL, GITHUB_UPLOADS_URL
                        API base URLs (default: github.com's)

Only the Python standard library is used.
"""

import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = os.environ.get("GITHUB_API_URL") or "https://api.github.com"
UPLOADS = os.environ.get("GITHUB_UPLOADS_URL") or "https://uploads.github.com"
DIST = "dist"
SEMVER = re.compile(r"^(\d+\.\d+\.\d+)(-[0-9A-Za-z.-]+)?$")


def fail(msg):
    print(f"publish: {msg}", file=sys.stderr)
    sys.exit(1)


def env(name, default=None):
    value = os.environ.get(name, default)
    if not value:
        fail(f"{name} is not set")
    return value


TOKEN = env("GITHUB_TOKEN")
REPO = os.environ.get("GITHUB_REPO") or "warpwire/plugin-sakai"
TAG = env("CI_COMMIT_TAG")
SHA = env("CI_COMMIT_SHA")
WAIT = int(os.environ.get("MIRROR_WAIT_SECONDS") or "900")


def gh(method, url, body=None, data=None, content_type="application/json"):
    """Calls the GitHub API. Returns (status, parsed JSON or None)."""
    if not url.startswith("http"):
        url = API + url
    payload = data if data is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=payload, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if payload is not None:
        req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, None


def version_from_tag():
    if not TAG.startswith("v"):
        fail(f"tag {TAG} does not start with 'v'")
    m = SEMVER.match(TAG[1:])
    if not m:
        fail(f"tag {TAG} is not v<semver>")
    return TAG[1:], m.group(1), bool(m.group(2))


def check_dist(version):
    war = f"warpwire-sakai-{version}.war"
    files = [war, "warpwire-register", "README.md", "SHA256SUMS"]
    for name in files:
        if not os.path.isfile(os.path.join(DIST, name)):
            fail(f"missing {DIST}/{name} (did the build job run for this tag?)")
    listed = {}
    with open(os.path.join(DIST, "SHA256SUMS")) as fh:
        for line in fh:
            digest, name = line.split()
            listed[name] = digest
    for name in (war, "warpwire-register", "README.md"):
        with open(os.path.join(DIST, name), "rb") as fh:
            actual = hashlib.sha256(fh.read()).hexdigest()
        if listed.get(name) != actual:
            fail(f"SHA256SUMS does not match {name}")
    print(f"publish: {DIST}/ checksums OK")
    return files


def release_notes(base_version, prerelease):
    with open("CHANGELOG.md") as fh:
        text = fh.read()
    m = re.search(
        rf"^## \[{re.escape(base_version)}\]([^\n]*)\n(.*?)(?=^## \[|\Z)",
        text,
        re.M | re.S,
    )
    if not m and prerelease:
        # A pre-release is usually cut before publish.sh dates the section.
        m = re.search(r"^## \[Unreleased\]([^\n]*)\n(.*?)(?=^## \[|\Z)", text, re.M | re.S)
    if not m:
        fail(f"CHANGELOG.md has no '## [{base_version}]' section")
    heading, body = m.group(1), m.group(2).strip()
    if not body:
        fail(f"the CHANGELOG.md section for {base_version} is empty")
    if not prerelease and "unreleased" in heading.lower():
        fail(f"CHANGELOG.md still marks {base_version} as Unreleased; set its date before tagging a final release")
    readme = f"https://github.com/{REPO}/blob/{urllib.parse.quote(TAG)}/README.md"
    return f"{body}\n\nInstallation and upgrade instructions for this version: [README at {TAG}]({readme})"


def commit_of_github_tag():
    """Returns the commit the tag points at on GitHub, or None if absent."""
    status, ref = gh("GET", f"/repos/{REPO}/git/ref/tags/{urllib.parse.quote(TAG)}")
    if status == 404:
        return None
    if status != 200:
        fail(f"GitHub API error {status} reading tag {TAG}: {ref}")
    obj = ref["object"]
    while obj["type"] == "tag":  # annotated tag: follow to the commit
        status, tag = gh("GET", obj["url"])
        if status != 200:
            fail(f"GitHub API error {status} reading annotated tag {TAG}")
        obj = tag["object"]
    return obj["sha"]


def wait_for_mirror():
    deadline = time.time() + WAIT
    while True:
        sha = commit_of_github_tag()
        if sha == SHA:
            print(f"publish: {TAG} is on GitHub at {SHA[:12]}")
            return
        if sha is not None:
            fail(f"{TAG} on GitHub points at {sha[:12]}, but CI built {SHA[:12]}; not publishing")
        if time.time() >= deadline:
            fail(f"{TAG} did not appear on GitHub within {WAIT}s; check the repository mirror, then retry this job")
        print(f"publish: waiting for {TAG} to be mirrored to GitHub...")
        time.sleep(min(30, max(1, int(deadline - time.time()))))


def main():
    version, base_version, prerelease = version_from_tag()
    files = check_dist(version)
    notes = release_notes(base_version, prerelease)
    wait_for_mirror()

    status, existing = gh("GET", f"/repos/{REPO}/releases/tags/{urllib.parse.quote(TAG)}")
    if status == 200:
        fail(f"a published release for {TAG} already exists: {existing.get('html_url')}")
    # Drafts aren't returned by the tag lookup; find and remove one from a failed run.
    status, releases = gh("GET", f"/repos/{REPO}/releases?per_page=100")
    if status != 200:
        fail(f"GitHub API error {status} listing releases")
    for rel in releases:
        if rel.get("draft") and rel.get("tag_name") == TAG:
            print(f"publish: deleting leftover draft release {rel['id']} for {TAG}")
            gh("DELETE", f"/repos/{REPO}/releases/{rel['id']}")

    status, rel = gh("POST", f"/repos/{REPO}/releases", body={
        "tag_name": TAG,
        "name": f"Warpwire Sakai plugin {version}",
        "body": notes,
        "draft": True,
        "prerelease": prerelease,
    })
    if status != 201:
        fail(f"GitHub API error {status} creating the release: {rel}")

    for name in files:
        with open(os.path.join(DIST, name), "rb") as fh:
            data = fh.read()
        url = f"{UPLOADS}/repos/{REPO}/releases/{rel['id']}/assets?name={urllib.parse.quote(name)}"
        status, asset = gh("POST", url, data=data, content_type="application/octet-stream")
        if status != 201:
            fail(f"GitHub API error {status} uploading {name}: {asset}")
        print(f"publish: uploaded {name} ({len(data)} bytes)")

    status, rel = gh("PATCH", f"/repos/{REPO}/releases/{rel['id']}", body={"draft": False})
    if status != 200:
        fail(f"GitHub API error {status} publishing the release: {rel}")
    print(f"publish: published {rel['html_url']}")


if __name__ == "__main__":
    main()
