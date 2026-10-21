#!/usr/bin/env bash
# Build @ziqu/plugin-dingze and install or update it on a NocoBase instance.
# Usage: NOCOBASE_SRC=/path/to/nocobase NOCOBASE_API_URL=https://host/api NOCOBASE_TOKEN=<admin token> \
#          server-plugins/scripts/deploy-dingze.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
api="${NOCOBASE_API_URL:?set NOCOBASE_API_URL, e.g. https://ziqu.aihupo.cn/api}"
token="${NOCOBASE_TOKEN:?set NOCOBASE_TOKEN to an admin API token}"
pkg="@ziqu/plugin-dingze"
version="$(node -p "require('$here/../plugin-dingze/package.json').version")"

"$here/build-dingze.sh"
tarball="$NOCOBASE_SRC/storage/tar/@ziqu/plugin-dingze-$version.tgz"
upload="$(mktemp -d)/plugin-dingze.tgz"
cp "$tarball" "$upload"

auth=(-H "Authorization: Bearer $token")
installed="$(curl -sS "${auth[@]}" "$api/pm:get?filterByTk=%40ziqu%2Fplugin-dingze" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).data?.version??'')}catch{console.log('')}})")"
if [ -z "$installed" ]; then
  curl -sS "${auth[@]}" -F "file=@$upload" "$api/pm:add"; echo
  curl -sS "${auth[@]}" -X POST "$api/pm:enable?filterByTk=%40ziqu%2Fplugin-dingze&awaitResponse=true"; echo
else
  curl -sS "${auth[@]}" -F "file=@$upload" --form-string "packageName=$pkg" "$api/pm:update?filterByTk=%40ziqu%2Fplugin-dingze"; echo
fi

for _ in $(seq 1 30); do
  sleep 5
  now="$(curl -sS --retry 3 "${auth[@]}" "$api/pm:get?filterByTk=%40ziqu%2Fplugin-dingze" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const d=JSON.parse(s).data;console.log(d.version+' '+d.enabled)}catch{console.log('')}})" || true)"
  if [ "$now" = "$version true" ]; then echo "$pkg $version enabled"; exit 0; fi
done
echo "Timed out waiting for $pkg $version (last: $now)" >&2
exit 1
