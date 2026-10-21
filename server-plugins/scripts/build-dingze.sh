#!/usr/bin/env bash
# Build @ziqu/plugin-dingze inside a NocoBase source tree and print the tarball path.
# Usage: NOCOBASE_SRC=/path/to/nocobase server-plugins/scripts/build-dingze.sh
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="${NOCOBASE_SRC:?set NOCOBASE_SRC to a NocoBase source checkout (same version as the target app)}"
target="$src/packages/plugins/@ziqu/plugin-dingze"
mkdir -p "$(dirname "$target")"
rm -rf "$target"
mkdir -p "$target"
(cd "$here/plugin-dingze" && tar --exclude=dist --exclude=node_modules -cf - .) | (cd "$target" && tar -xf -)
cd "$src"
yarn build @ziqu/plugin-dingze --tar --no-dts
ls -1 "$src"/storage/tar/@ziqu/plugin-dingze-*.tgz
