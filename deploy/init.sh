#!/bin/sh
# Run from any directory; key stays outside the image and MUST accompany DB backups.
# Optional first argument is deployment root (for an independently staged deployment).
set -eu
root=${1:-$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)}
secrets=$root/.secrets
umask 077
if [ -L "$secrets" ]; then
  echo 'Refusing a symlinked secrets directory.' >&2
  exit 1
fi
mkdir -p "$secrets"
chmod 700 "$secrets"
key=$secrets/master-key
if [ -e "$key" ] || [ -L "$key" ]; then
  if [ ! -f "$key" ] || [ -L "$key" ] || [ ! -s "$key" ]; then
    echo 'Existing master-key is not a nonempty regular file; refusing to replace it.' >&2
    exit 1
  fi
  echo 'Preserving existing encryption master key.'
else
  tmp=$(mktemp "$secrets/.master-key.XXXXXX")
  trap 'rm -f "$tmp"' EXIT HUP INT TERM
  openssl rand 32 > "$tmp"
  # Exclusive publication: a simultaneous initializer can never overwrite a key.
  ln "$tmp" "$key"
  rm -f "$tmp"
  trap - EXIT HUP INT TERM
  echo 'Created encryption master key; back it up securely, separately from the DB.'
fi
# Compose file-secrets may be bind mounts without uid remapping. Parent mode 0700
# restricts host access, while mode 0444 lets container UID 1000 read the mounted file.
chmod 444 "$key"
