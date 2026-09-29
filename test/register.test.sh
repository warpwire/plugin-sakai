#!/usr/bin/env bash
#
# Scenario tests for bin/warpwire-register, run against a copy of Sakai 25.2's
# ckeditor.launch.js (test/fixtures). No running Sakai is required; needs bash
# and node. Run: bash register.test.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
TOOL="$HERE/../bin/warpwire-register"
SRC="${1:-$HERE/fixtures/ckeditor.launch.sakai-25.2.js}"
S="$(mktemp -d)"; trap 'rm -rf "$S"' EXIT
mkdir -p "$S/cb/webapps/library/editor"
L="$S/cb/webapps/library/editor/ckeditor.launch.js"
cp "$SRC" "$L"; cp "$L" "$S/orig.js"
R() { "$TOOL" --catalina-base "$S/cb" "$@"; }
pass=0; fail=0
check() { if eval "$2"; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1"; fail=$((fail+1)); fi; }

R install --dry-run >/dev/null; check "dry-run changes nothing" 'cmp -s "$L" "$S/orig.js"'
R install >/dev/null; check "install exit 0" '[ $? -eq 0 ]'
check "one marker line after anchor" '[ "$(grep -c warpwire-sakai-register "$L")" = 1 ] && grep -A1 "addExternal(.contentitem." "$L" | grep -q warpwire-sakai-register'
cp "$L" "$S/installed.js"
out="$(R install)"; check "re-run is a no-op" 'cmp -s "$L" "$S/installed.js" && echo "$out" | grep -q "already registered"'
R uninstall >/dev/null; check "uninstall restores byte-identical" 'cmp -s "$L" "$S/orig.js"'
check "backup removed after clean uninstall" '[ ! -e "$L.warpwire-backup" ]'
out="$(R uninstall)"; check "uninstall when not registered is a no-op" 'echo "$out" | grep -q "not registered"'

sed "s/addExternal('contentitem'/addExternal('contentitemX'/" "$S/orig.js" > "$L"; cp "$L" "$S/before.js"
R install 2>/dev/null >/dev/null; rc=$?; check "missing anchor exits 1, file unchanged" '[ $rc -eq 1 ] && cmp -s "$L" "$S/before.js"'
{ cat "$S/orig.js"; echo "        CKEDITOR.plugins.addExternal('contentitem',basePath+'x/', 'plugin.js');"; } > "$L"; cp "$L" "$S/before.js"
R install 2>/dev/null >/dev/null; rc=$?; check "duplicate anchor exits 1, file unchanged" '[ $rc -eq 1 ] && cmp -s "$L" "$S/before.js"'
sed "s#\(CKEDITOR.plugins.addExternal('contentitem'[^;]*;\)#CKEDITOR.plugins.addExternal('warpwirecontentitem',basePath+'warpwirecontentitem/', 'plugin.js');\n\1#" "$S/orig.js" > "$L"; cp "$L" "$S/before.js"
R install 2>/dev/null >/dev/null; rc=$?; check "legacy/manual registration refused, file unchanged" '[ $rc -eq 1 ] && cmp -s "$L" "$S/before.js"'

cp "$S/orig.js" "$L"; R install >/dev/null; R install --context /ww2 >/dev/null
check "context change updates the line in place" '[ "$(grep -c warpwire-sakai-register "$L")" = 1 ] && grep -q "/ww2/editor/warpwirecontentitem/" "$L"'
R uninstall >/dev/null; check "uninstall after update is byte-identical" 'cmp -s "$L" "$S/orig.js"'

printf '%s' "$(cat "$S/orig.js")" > "$L"; cp "$L" "$S/nonl.js"
R install >/dev/null; R uninstall >/dev/null; check "file without trailing newline round-trips" 'cmp -s "$L" "$S/nonl.js"'
cp "$S/orig.js" "$L"; chmod 640 "$L"; R install >/dev/null
# GNU stat (Linux) first: on GNU, "stat -f" means filesystem status, not format.
check "file mode preserved" '[ "$(stat -c %a "$L" 2>/dev/null || stat -f %Lp "$L")" = 640 ]'
R status >/dev/null; rc=$?; check "status fails when webapp + properties missing" '[ $rc -eq 1 ]'
mkdir -p "$S/cb/webapps/warpwire/editor/warpwirecontentitem" "$S/cb/webapps/warpwire/scripts" "$S/cb/sakai"
touch "$S/cb/webapps/warpwire/editor/warpwirecontentitem/plugin.js" "$S/cb/webapps/warpwire/scripts/warpwire.js"
echo 'portal.include.extrahead=<script>window.WARPWIRE_DEPLOY={instanceDomain:"https://x.warpwire.com"};</script><script src="/warpwire/scripts/warpwire.js"></script>' > "$S/cb/sakai/local.properties"
R status >/dev/null; rc=$?; check "status passes when all present" '[ $rc -eq 0 ]'
R uninstall >/dev/null
# The inserted line must be valid JS in context: run it against a stub.
line="$(R install --dry-run | tail -1)"
node -e "var CKEDITOR={plugins:{addExternal:function(n,p,f){globalThis.reg=[n,p,f];}}}; var ckconfig={extraPlugins:'a,b,,c'}; $line; if(ckconfig.extraPlugins!=='a,b,,c,warpwirecontentitem'||reg[1]!=='/warpwire/editor/warpwirecontentitem/') process.exit(1); ckconfig={extraPlugins:['x']}; $line; if(ckconfig.extraPlugins!=='x,warpwirecontentitem') process.exit(1); ckconfig={}; $line; if(ckconfig.extraPlugins!=='warpwirecontentitem') process.exit(1);"
check "inserted JS works for string/array/missing extraPlugins" '[ $? -eq 0 ]'
echo "== $pass passed, $fail failed"; [ $fail -eq 0 ]
