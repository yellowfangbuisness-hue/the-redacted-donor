#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
name='The Redacted Donor.app'
cache=$(mktemp -d "${TMPDIR:-/tmp}/donor-build.XXXXXX")
app="$cache/$name/Contents"
mkdir -p "$app/MacOS" "$app/Resources"
cp -X index.html "$app/Resources/index.html"
cp -X native/Info.plist "$app/Info.plist"
trap 'python3 -c "import shutil,sys; shutil.rmtree(sys.argv[1], ignore_errors=True)" "$cache"' EXIT
iconset="$cache/Donor.iconset"
mkdir -p "$iconset"
sips -c 940 940 --cropOffset 0 475 -s format png src/art/title.jpg --out "$cache/icon.png" >/dev/null
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$cache/icon.png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$cache/icon.png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
python3 - "$iconset" "$app/Resources/Donor.icns" <<'PYICON'
from pathlib import Path
import struct, sys
icons = Path(sys.argv[1])
chunks = []
for tag, size, scale in [('icp4',16,1),('icp5',32,1),('icp6',32,2),('ic07',128,1),('ic08',256,1),('ic09',512,1),('ic10',512,2)]:
    suffix = '@2x' if scale == 2 else ''
    png = (icons / f'icon_{size}x{size}{suffix}.png').read_bytes()
    chunks.append(tag.encode() + struct.pack('>I', len(png) + 8) + png)
data = b''.join(chunks)
Path(sys.argv[2]).write_bytes(b'icns' + struct.pack('>I', len(data) + 8) + data)
PYICON
swiftc -O -parse-as-library -target arm64-apple-macos13 -module-cache-path "${TMPDIR:-/tmp}/redacted-donor-swift-modules" -framework AppKit -framework WebKit native/Game.swift -o "$app/MacOS/RedactedDonor"
codesign --force --sign - "$cache/$name"
codesign --verify --deep --strict "$cache/$name"
ditto --noextattr --norsrc "$cache/$name" "$name"
codesign --verify --deep "$name"
