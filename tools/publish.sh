#!/bin/sh
# The public duowave-packages from this working copy: HEAD's tree only (git archive — nothing uncommitted, no history),
# checked for anything private (the gateway's scripts/release/check-private.mjs with the household's list) and for a
# catalog that builds, laid over the public clone and committed there as «DuoWave <hello@duowave.ai>» in UTC. The
# working history, its author and time zone stay here. It never pushes: pushing is the owner's step, from the owner's
# own terminal (the public clone's pre-push asks for «да»).
#
#   tools/publish.sh <public clone folder>                 commit HEAD's tree there
#   MESSAGE="…" tools/publish.sh <public clone folder>     with this message instead of «Каталог DuoWave»
#   CHECK_PRIVATE=<…/check-private.mjs> tools/publish.sh …  the check elsewhere than ../voice-gateway-server
set -eu
ROOT=$(git rev-parse --show-toplevel)
PUBLIC=${1:?usage: tools/publish.sh <public clone folder>}
CHECK=${CHECK_PRIVATE:-$ROOT/../voice-gateway-server/scripts/release/check-private.mjs}
[ -f "$CHECK" ] || { echo "no check for anything private at $CHECK: set CHECK_PRIVATE" >&2; exit 1; }
if [ -d "$PUBLIC/.git" ]; then
    [ -z "$(git -C "$PUBLIC" status --porcelain)" ] || { echo "$PUBLIC has changes of its own: commit or drop them" >&2; exit 1; }
else
    mkdir -p "$PUBLIC"
    git -C "$PUBLIC" init -q -b main
fi
TREE=$(mktemp -d)
git -C "$ROOT" archive HEAD | tar -x -C "$TREE"
node "$CHECK" --dir "$TREE"
node "$TREE/tools/build.mjs" --check
rsync -a --delete --exclude /.git "$TREE/" "$PUBLIC/"
cd "$PUBLIC"
git add -A
if git diff --cached --quiet; then
    echo "nothing changed since the last publish"
else
    TZ=UTC GIT_AUTHOR_NAME=DuoWave GIT_AUTHOR_EMAIL=hello@duowave.ai GIT_COMMITTER_NAME=DuoWave \
        GIT_COMMITTER_EMAIL=hello@duowave.ai git commit -q -m "${MESSAGE:-Каталог DuoWave}"
    echo "committed: $(git log --oneline -1)"
fi
echo
echo "to publish (the owner's step):"
echo "  git -C $PUBLIC push origin main"
