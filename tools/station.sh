#!/bin/sh
# The station's one-line install on this site: /station.sh and the station build it names at
# /station/<version>/duowave-station-aarch64.tar.gz (with its .sig). A person logged in to a Yandex Station over SSH
# types `wget -qO- http://get.duowave.app/station.sh | sh` there (the gateway's station-client/station.sh). Plain HTTP:
# the station's busybox has no TLS, and this site answers HTTPS only («Enforce HTTPS» stays on). get.duowave.app is a
# Cloudflare Worker that takes exactly these paths from here over HTTPS and hands them on over HTTP; anything else is
# 404 there (the gateway's scripts/release/cloudflare).
#
# Both files come from the gateway's release (its release.yml writes the version and the build's SHA-256 into
# station.sh). They are served only when:
#   - the build's signature holds against gateway-updates.pub: the update keys every gateway trusts (the gateway's
#     gateway/updates.pub, copied here: a change in the gateway's repository alone cannot swap them), Tauri's base64 of
#     minisign's .pub text, a key per line;
#   - its release.json names the version station.sh names, for duowave-station-aarch64;
#   - station.sh names its exact SHA-256.
# On the station the checksum then holds the download to the script.
#
#   tools/station.sh <dist> [<folder>]
#     <folder>: station.sh, duowave-station-aarch64.tar.gz and its .sig already there; without it they are downloaded
#     from the gateway's latest release (gh, GH_TOKEN). A release without station.sh (before the gateway's 0.18.3) is
#     left out with a warning, and the site builds as before.
#   STATION_KEYS: other keys than gateway-updates.pub (a check's throwaway key). Needs minisign, tar, sha256sum.
set -eu
dist=${1:?the site folder: dist}
here=$(cd "$(dirname "$0")/.." && pwd)
keys=${STATION_KEYS:-$here/gateway-updates.pub}
repo=${STATION_REPO:-duowaveai/duowave}
name=duowave-station-aarch64.tar.gz

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
if [ -n "${2:-}" ]; then
    in=$2
else
    in=$work/in
    mkdir -p "$in"
    # gh succeeds as soon as one pattern matches: a release before 0.18.3 has the build and its .sig but no station.sh
    # (catalog pages run of 22.11 failed on it), so its absence is checked after the download too.
    if ! gh release download --repo "$repo" --dir "$in" --pattern station.sh --pattern "$name" --pattern "$name.sig" ||
        [ ! -f "$in/station.sh" ]; then
        echo "::warning::the latest release of $repo has no station.sh: the station's one-line install is not served"
        exit 0
    fi
fi
for file in station.sh "$name" "$name.sig"; do
    [ -f "$in/$file" ] || { echo "::error::$file is missing from the release"; exit 1; }
done

version=$(sed -n 's/.*DUOWAVE_VERSION:-\([^}]*\)}.*/\1/p' "$in/station.sh" | head -n 1)
sha=$(sed -n 's/.*DUOWAVE_SHA256:-\([^}]*\)}.*/\1/p' "$in/station.sh" | head -n 1)
case $version in '' | *[!0-9A-Za-z.+-]*) echo "::error::station.sh names no release version: '$version'"; exit 1 ;; esac
case $sha in *[!0-9a-f]* | '') echo "::error::station.sh names no SHA-256: '$sha'"; exit 1 ;; esac
[ ${#sha} = 64 ] || { echo "::error::station.sh names no SHA-256: '$sha'"; exit 1; }

got=$(sha256sum "$in/$name" | cut -d' ' -f1)
[ "$got" = "$sha" ] || { echo "::error::$name is $got, station.sh names $sha"; exit 1; }
release=$(tar -xzOf "$in/$name" release.json)
case $release in
    *'"version":"'"$version"'"'*'"platform":"duowave-station-aarch64"'*) ;;
    *) echo "::error::$name says $release, station.sh names $version"; exit 1 ;;
esac

# Tauri keeps the signature and the keys as base64 of minisign's own text.
base64 -d <"$in/$name.sig" >"$work/build.minisig"
signed=
for line in $(grep -v '^[[:space:]]*$' "$keys"); do
    key=$(printf '%s' "$line" | base64 -d | grep -v '^untrusted comment:' | head -n 1)
    if minisign -Vq -P "$key" -m "$in/$name" -x "$work/build.minisig"; then
        signed=$key
        break
    fi
done
[ -n "$signed" ] || { echo "::error::$name.sig matches no key of $(basename "$keys")"; exit 1; }

mkdir -p "$dist/station/$version"
cp "$in/$name" "$in/$name.sig" "$dist/station/$version/"
cp "$in/station.sh" "$dist/station.sh"
echo "station.sh: $version, $sha, signed by $signed"
