#!/usr/bin/env bash
#
# Prepares a release: bumps the version, dates the changelog, commits, and
# creates the release tag. It does NOT push; it prints the push command. Pushing
# the tag starts the CI release (GitHub Releases), so review before you push.
#
# Usage:
#   ./publish.sh patch|minor|major           final release
#   ./publish.sh patch|minor|major --alpha   alpha pre-release
#
# What it does:
#   1. checks you're on the release branch (master) with a clean tree, not
#      behind origin;
#   2. finds the latest release tag (v<x.y.z>) and computes the next version;
#   3. checks CHANGELOG.md has a non-empty "## [Unreleased]" section;
#   4. shows the plan and asks you to confirm;
#   5. sets NS.version in webapp/scripts/warpwire.js, renames the changelog's
#      "## [Unreleased]" to "## [<version>] - <today>" (adding a fresh empty
#      Unreleased section above it), and checks the release builds (./build.sh);
#   6. commits "Release <version>" and creates the annotated tag v<version>.
#
# With --alpha, the version is the next one plus "-alpha.N" (N counts up from 1
# for each alpha of that version, e.g. v3.1.0-alpha.1, v3.1.0-alpha.2). An alpha
# only tags the current commit: NS.version and CHANGELOG.md are left alone (the
# build stamps the alpha version into the artifact, and CI takes the release
# notes from "## [Unreleased]"). GitHub marks it as a pre-release.
#
# Environment:
#   RELEASE_BRANCH   branch releases are cut from (default: master)
#   RELEASE_REMOTE   remote to check against and push to (default: origin)

set -euo pipefail

cd "$(dirname "$0")"
RUNTIME="webapp/scripts/warpwire.js"
CHANGELOG="CHANGELOG.md"
BRANCH="${RELEASE_BRANCH:-master}"
REMOTE="${RELEASE_REMOTE:-origin}"

die() { echo "publish: $*" >&2; exit 1; }

usage() { echo "Usage: ./publish.sh patch|minor|major [--alpha]" >&2; exit 2; }
BUMP=""
ALPHA=0
for arg in "$@"; do
	case "$arg" in
		patch|minor|major) [ -z "$BUMP" ] || usage; BUMP="$arg" ;;
		--alpha) ALPHA=1 ;;
		-h|--help) sed -n '2,/^set -euo/p' "$0" | sed -e '/^set -euo/d' -e 's/^# \{0,1\}//'; exit 0 ;;
		*) usage ;;
	esac
done
[ -n "$BUMP" ] || usage

# --- 1. Repository state ---------------------------------------------------
current_branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$current_branch" = "$BRANCH" ] || die "releases are cut from '$BRANCH'; you're on '$current_branch'"
[ -z "$(git status --porcelain)" ] || die "the working tree has uncommitted changes; commit or stash them first"

echo ">>> Fetching $REMOTE (branches and tags)"
git fetch --quiet --tags "$REMOTE"
if git rev-parse --verify --quiet "$REMOTE/$BRANCH" >/dev/null; then
	behind="$(git rev-list --count "HEAD..$REMOTE/$BRANCH")"
	[ "$behind" = "0" ] || die "'$BRANCH' is $behind commit(s) behind $REMOTE/$BRANCH; pull first"
fi

# --- 2. Versions -----------------------------------------------------------
# Latest final release tag (pre-release tags like v3.1.0-rc.1 are ignored).
latest="$(git tag -l 'v*' | python3 -c '
import re, sys
vs = [tuple(map(int, m.groups())) for t in sys.stdin
      for m in [re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", t.strip())] if m]
print(".".join(map(str, max(vs))) if vs else "")
')"
[ -n "$latest" ] || die "no release tags (v<x.y.z>) found; tag the current release first"

next="$(python3 -c '
import sys
major, minor, patch = map(int, sys.argv[1].split("."))
bump = sys.argv[2]
if bump == "major": major, minor, patch = major + 1, 0, 0
elif bump == "minor": minor, patch = minor + 1, 0
else: patch += 1
print(f"{major}.{minor}.{patch}")
' "$latest" "$BUMP")"
release_version="$next"
if [ "$ALPHA" = 1 ]; then
	n="$(git tag -l "v$next-alpha.*" | python3 -c '
import re, sys
ns = [int(m.group(1)) for t in sys.stdin
      for m in [re.fullmatch(r"v\d+\.\d+\.\d+-alpha\.(\d+)", t.strip())] if m]
print(max(ns) + 1 if ns else 1)
')"
	release_version="$next-alpha.$n"
fi
TAG="v$release_version"

git rev-parse --verify --quiet "refs/tags/$TAG" >/dev/null && die "tag $TAG already exists locally"
[ -z "$(git ls-remote --tags "$REMOTE" "refs/tags/$TAG")" ] || die "tag $TAG already exists on $REMOTE"

source_version="$(sed -n -E 's/^[[:space:]]*NS\.version = "([^"]+)";.*/\1/p' "$RUNTIME")"
[ -n "$source_version" ] || die "couldn't read NS.version from $RUNTIME"

# --- 3. Changelog ----------------------------------------------------------
notes="$(python3 - "$CHANGELOG" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
m = re.search(r"^## \[Unreleased\][^\n]*\n(.*?)(?=^## \[|\Z)", text, re.M | re.S)
if not m:
    sys.exit("publish: CHANGELOG.md has no '## [Unreleased]' section")
body = m.group(1).strip()
if not body:
    sys.exit("publish: the '## [Unreleased]' section in CHANGELOG.md is empty; describe the changes first")
print(body)
PY
)"

# --- 4. Confirm ------------------------------------------------------------
today="$(date +%Y-%m-%d)"
if [ "$ALPHA" = 1 ]; then
	kind="$BUMP bump, alpha pre-release"
	changes="none: tags the current commit; NS.version and CHANGELOG.md unchanged"
else
	kind="$BUMP bump"
	changes="NS.version -> $next; \"## [Unreleased]\" becomes \"## [$next] - $today\""
fi
cat <<EOF

  Latest release:   v$latest
  Source version:   $source_version   ($RUNTIME)
  New version:      $release_version   ($kind)
  Tag:              $TAG
  File changes:     $changes

  Release notes:
$(printf '%s\n' "$notes" | sed 's/^/    | /')

EOF
if [ "$ALPHA" = 1 ]; then prompt="Create the alpha tag $TAG?"; else prompt="Create the release commit and tag $TAG?"; fi
printf '%s [y/N] ' "$prompt"
read -r answer || answer=""
case "$answer" in
	y|Y|yes|YES) ;;
	*) echo "Cancelled; nothing changed."; exit 1 ;;
esac

# --- Alpha: check the build and tag the current commit --------------------
if [ "$ALPHA" = 1 ]; then
	echo ">>> Checking the release builds"
	CI_COMMIT_TAG="$TAG" ./build.sh >/dev/null
	git tag -a "$TAG" -m "Warpwire Sakai plugin $release_version (alpha)"
	cat <<EOF

Created tag $TAG on $(git rev-parse --short HEAD) (not pushed).

Push it (with $BRANCH, in case it has unpushed commits):

    git push --atomic $REMOTE $BRANCH $TAG

Pushing the tag starts the CI release, which publishes a GitHub pre-release
once the mirror has the tag. To undo before pushing:

    git tag -d $TAG
EOF
	exit 0
fi

# --- 5. Update files and check the build ----------------------------------
restore() { git checkout -- "$RUNTIME" "$CHANGELOG" 2>/dev/null || true; }
trap 'echo "publish: failed; reverting file changes" >&2; restore' ERR

sed -E "s/^([[:space:]]*NS\.version = )\"[^\"]+\";/\1\"$next\";/" "$RUNTIME" > "$RUNTIME.tmp"
mv "$RUNTIME.tmp" "$RUNTIME"
[ "$(sed -n -E 's/^[[:space:]]*NS\.version = "([^"]+)";.*/\1/p' "$RUNTIME")" = "$next" ] || { restore; die "failed to set NS.version"; }

python3 - "$CHANGELOG" "$next" "$today" <<'PY'
import re, sys
path, version, today = sys.argv[1:]
text = open(path).read()
text, n = re.subn(r"^## \[Unreleased\][^\n]*\n", f"## [Unreleased]\n\n## [{version}] - {today}\n", text, count=1, flags=re.M)
if n != 1:
    sys.exit("publish: failed to update CHANGELOG.md")
open(path, "w").write(text)
PY

echo ">>> Checking the release builds"
CI_COMMIT_TAG="$TAG" ./build.sh >/dev/null

# --- 6. Commit and tag ----------------------------------------------------
git add "$RUNTIME" "$CHANGELOG"
git commit --quiet -m "Release $next"
git tag -a "$TAG" -m "Warpwire Sakai plugin $next"
trap - ERR

cat <<EOF

Created commit $(git rev-parse --short HEAD) "Release $next" and tag $TAG (not pushed).

Review it, then push the commit and the tag together:

    git push --atomic $REMOTE $BRANCH $TAG

Pushing the tag starts the CI release, which publishes to GitHub Releases once
the mirror has the tag. To undo before pushing:

    git tag -d $TAG && git reset --hard HEAD~1
EOF
