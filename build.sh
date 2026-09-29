#!/usr/bin/env bash
#
# Builds the Warpwire Sakai plugin release artifacts into dist/:
#
#   warpwire-sakai-<version>.war   the plugin webapp (deploy as webapps/warpwire.war)
#   warpwire-register              the registration tool
#   SHA256SUMS                     checksums for both
#
# The build is reproducible: the same source at the same commit gives
# byte-identical artifacts (sorted entries, fixed timestamps and permissions).
#
# Usage:
#   ./build.sh                  version from webapp/scripts/warpwire.js
#   ./build.sh --version 3.1.0  build a specific version
#   CI_COMMIT_TAG=v3.1.0 ./build.sh   (CI) version from the tag
#
# Requires bash, python3 and git (git only for the timestamp; set
# SOURCE_DATE_EPOCH to build without git).
#
# Before packaging, the build fails if the webapp contains internal hostnames
# or credentials (patterns in release-denylist.txt). Extra patterns can be
# supplied in RELEASE_DENYLIST (one extended regex per line), e.g. from a CI
# variable.

set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(pwd)"
SRC="$ROOT/webapp"
DIST="$ROOT/dist"
RUNTIME="scripts/warpwire.js"
VERSION_RE='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'

VERSION=""
while [ $# -gt 0 ]; do
	case "$1" in
		--version) [ $# -ge 2 ] || { echo "--version needs a value" >&2; exit 2; }; VERSION="$2"; shift ;;
		-h|--help) sed -n '2,/^set -euo/p' "$0" | sed -e '/^set -euo/d' -e 's/^# \{0,1\}//'; exit 0 ;;
		*) echo "unknown argument: $1" >&2; exit 2 ;;
	esac
	shift
done

source_version() { sed -n -E 's/^[[:space:]]*NS\.version = "([^"]+)";.*/\1/p' "$SRC/$RUNTIME"; }

if [ -z "$VERSION" ] && [ -n "${CI_COMMIT_TAG:-}" ]; then VERSION="${CI_COMMIT_TAG#v}"; fi
[ -n "$VERSION" ] || VERSION="$(source_version)"
[[ "$VERSION" =~ $VERSION_RE ]] || { echo "build: invalid version '$VERSION' (expected semver, e.g. 3.1.0)" >&2; exit 1; }

# A final release tag must match the version in the source, so the tagged source
# and the published artifact agree (publish.sh sets both). Pre-release tags
# (v3.1.0-rc.1) are exempt: they're cut before the version is bumped.
if [ -n "${CI_COMMIT_TAG:-}" ] && [[ "$VERSION" != *-* ]] && [ "$VERSION" != "$(source_version)" ]; then
	echo "build: tag $CI_COMMIT_TAG doesn't match NS.version \"$(source_version)\" in $RUNTIME (use ./publish.sh to release)" >&2
	exit 1
fi

if [ -z "${SOURCE_DATE_EPOCH:-}" ]; then
	SOURCE_DATE_EPOCH="$(git -C "$ROOT" log -1 --format=%ct 2>/dev/null || true)"
	[ -n "$SOURCE_DATE_EPOCH" ] || { echo "build: set SOURCE_DATE_EPOCH (no git history found)" >&2; exit 1; }
fi
export SOURCE_DATE_EPOCH

WAR="warpwire-sakai-$VERSION.war"
echo ">>> Building $WAR (source date $SOURCE_DATE_EPOCH)"

# Empty dist/ rather than deleting it, so a bind mount of dist/ (e.g. a dev
# container) keeps working across builds.
mkdir -p "$DIST"
find "$DIST" -mindepth 1 -delete
mkdir -p "$DIST/stage"
STAGE="$DIST/stage/webapp"
cp -R "$SRC" "$STAGE"

# Stamp the version into the one place it is defined (the shared runtime).
count="$(grep -c -E '^[[:space:]]*NS\.version = "[^"]+";' "$STAGE/$RUNTIME" || true)"
[ "$count" = "1" ] || { echo "build: expected exactly one NS.version line in $RUNTIME, found $count" >&2; exit 1; }
sed -E "s/^([[:space:]]*NS\.version = )\"[^\"]+\";/\1\"$VERSION\";/" "$STAGE/$RUNTIME" > "$STAGE/$RUNTIME.tmp"
mv "$STAGE/$RUNTIME.tmp" "$STAGE/$RUNTIME"
[ "$(sed -n -E 's/^[[:space:]]*NS\.version = "([^"]+)";.*/\1/p' "$STAGE/$RUNTIME")" = "$VERSION" ] || { echo "build: version stamp failed" >&2; exit 1; }

sed "s/^TOOL_VERSION=\"dev\"$/TOOL_VERSION=\"$VERSION\"/" "$ROOT/bin/warpwire-register" > "$DIST/warpwire-register"
grep -q "^TOOL_VERSION=\"$VERSION\"$" "$DIST/warpwire-register" || { echo "build: failed to stamp the registration tool version" >&2; exit 1; }
chmod 755 "$DIST/warpwire-register"

# Public-content check: the artifacts are published on the public GitHub
# repository, so they must not contain internal hostnames or credentials.
check_public_content() {
	local patterns hits
	patterns="$(sed -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d' "$ROOT/release-denylist.txt")"
	if [ -n "${RELEASE_DENYLIST:-}" ]; then patterns="$patterns"$'\n'"$RELEASE_DENYLIST"; fi
	hits="$(printf '%s\n' "$patterns" | sed '/^[[:space:]]*$/d' | grep -r -n -I -i -E -f /dev/stdin "$@" || true)"
	if [ -n "$hits" ]; then
		echo "build: public-content check FAILED; these lines must not be published:" >&2
		printf '%s\n' "$hits" | cut -c1-200 >&2
		exit 1
	fi
	echo ">>> Public-content check passed"
}
check_public_content "$STAGE" "$DIST/warpwire-register"

# Deterministic zip: sorted entries, fixed timestamp, fixed permissions. Entries
# are stored uncompressed so the bytes don't depend on the zlib version.
python3 - "$STAGE" "$DIST/$WAR" <<'PY'
import os, sys, time, zipfile
src, out = sys.argv[1], sys.argv[2]
epoch = max(int(os.environ["SOURCE_DATE_EPOCH"]), 315532800)  # zip can't go before 1980
stamp = time.gmtime(epoch)[:6]
files = []
for dirpath, dirnames, filenames in os.walk(src):
    for name in filenames:
        if name == ".DS_Store":
            continue
        full = os.path.join(dirpath, name)
        files.append(os.path.relpath(full, src).replace(os.sep, "/"))
with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as zf:
    for rel in sorted(files):
        info = zipfile.ZipInfo(rel, stamp)
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_STORED
        info.create_system = 3
        with open(os.path.join(src, rel), "rb") as fh:
            zf.writestr(info, fh.read())
print(f">>> Wrote {len(files)} files to {os.path.basename(out)}")
PY

rm -rf "$DIST/stage"
(
	cd "$DIST"
	python3 - "$WAR" warpwire-register > SHA256SUMS <<'PY'
import hashlib, sys
for name in sys.argv[1:]:
    with open(name, "rb") as fh:
        print(f"{hashlib.sha256(fh.read()).hexdigest()}  {name}")
PY
)
echo ">>> dist/:"
cat "$DIST/SHA256SUMS"
