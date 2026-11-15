#!/bin/sh
# Packs the Windows version: the game file, a launcher and a readme, in a folder and a zip. Run after `node build.mjs`.
# There is no .exe: the launcher opens the same single-file game in Edge or Chrome, which every Windows 10/11 PC has.
set -e
cd "$(dirname "$0")/.."
OUT="The Redacted Donor (Windows)"
rm -rf "$OUT" "$OUT.zip"
mkdir "$OUT"
cp index.html "native/windows/Play The Redacted Donor.cmd" native/windows/README.txt "$OUT/"
if [ -f hand-tracking.js ]; then cp hand-tracking.js "$OUT/"; fi
zip -qr "$OUT.zip" "$OUT"
echo "Packed $OUT.zip ($(du -h "$OUT.zip" | cut -f1 | tr -d ' '))"
