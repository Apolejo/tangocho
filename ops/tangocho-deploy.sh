#!/bin/bash
# The deploy user's forced command on the Oracle VM (docs/ORACLE.md), installed as
# /usr/local/bin/tangocho-deploy. CI's key may do two things only:
#   rsync dist/ into incoming/ (write-only, symlinks munged), and
#   activate <sha>: hard-link incoming/ into releases/<sha>/, refuse it unless every file the
#   service worker precaches is there, then switch the current symlink to it in one rename.
# A half-finished upload stays in incoming/ and is never served. Five releases are kept.
# TANGOCHO_ROOT and RRSYNC are for the tests; sshd passes no such variables (AcceptEnv is LANG LC_*).
set -euo pipefail

root=${TANGOCHO_ROOT:-/srv/tangocho}
rrsync=${RRSYNC:-/usr/bin/rrsync}
keep=5

fail() {
  echo "tangocho-deploy: $*" >&2
  exit 1
}

# Prints what a release lacks, one line each; fails if anything does.
check_release() {
  local dir=$1 name odd
  local -a problems=() urls=() runtime=()
  for name in index.html sw.js manifest.webmanifest; do
    [[ -f $dir/$name ]] || problems+=("missing $name")
  done
  if [[ -f $dir/sw.js ]]; then
    # Workbox's generated worker: {url:"assets/…",revision:…} for each precached file, and
    # define(["./workbox-<hash>"],…) for the runtime it loads at install
    mapfile -t urls < <(grep -o 'url:"[^"]*"' "$dir/sw.js" | sed 's/^url:"//; s/"$//')
    mapfile -t runtime < <(grep -o '"\./workbox-[A-Za-z0-9_-]*"' "$dir/sw.js" | sed 's/^"\.\///; s/"$/.js/')
    ((${#urls[@]} > 0)) || problems+=("sw.js lists no precached files")
    for name in "${urls[@]}" "${runtime[@]}"; do
      if [[ $name == /* || $name == *..* ]]; then
        problems+=("unexpected path in sw.js: $name")
      elif [[ ! -f $dir/$name ]]; then
        problems+=("missing $name")
      fi
    done
  fi
  odd=$(find "$dir" -mindepth 1 ! -type f ! -type d -printf '%P\n')
  [[ -z $odd ]] || problems+=("not a file or folder: ${odd//$'\n'/, }")
  if ((${#problems[@]} > 0)); then
    printf '  %s\n' "${problems[@]}" >&2
    return 1
  fi
}

# Keeps the five most recently activated releases, and always the one being served.
prune() {
  local serving name n=0
  serving=$(readlink current)
  rm -rf releases/.tmp.*
  while IFS= read -r name; do
    n=$((n + 1))
    if ((n > keep)) && [[ releases/$name != "$serving" ]]; then
      rm -rf "releases/$name"
      echo "tangocho-deploy: removed $name"
    fi
  done < <(ls -1t releases)
}

activate() {
  local sha=$1 release tmp
  [[ $sha =~ ^[0-9a-f]{40}$ ]] || fail "activate needs a full commit sha, got '$sha'"
  cd "$root"
  release=releases/$sha
  # the lock rrsync takes on incoming/ while it writes: never copy a half-written upload
  exec 9<incoming
  flock -w 120 9 || fail "incoming/ is still locked by an upload"
  if [[ -d $release ]]; then
    check_release "$release" || fail "refused $sha: releases/$sha is incomplete"
  else
    tmp=releases/.tmp.$sha
    rm -rf "$tmp"
    cp -al incoming "$tmp"
    if ! check_release "$tmp"; then
      rm -rf "$tmp"
      fail "refused $sha: the upload is incomplete, still serving $(readlink current 2>/dev/null || echo nothing)"
    fi
    mv -T "$tmp" "$release"
  fi
  ln -sfn "$release" current.tmp
  mv -T current.tmp current
  # the folder only: releases share their unchanged files' inodes
  touch "$release"
  prune
  echo "tangocho-deploy: serving $sha"
}

command=${SSH_ORIGINAL_COMMAND:-}
case $command in
  'rsync --server '*) exec "$rrsync" -wo -munge "$root/incoming" ;;
  'activate '*) activate "${command#activate }" ;;
  *) fail "allowed: rsync into incoming/, or activate <sha>" ;;
esac
