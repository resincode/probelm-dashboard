#!/bin/sh
# Uses Podman named volumes on both macOS VM and Linux; no volume filesystem assumptions.
# Build first: podman build -t localhost/probelm-dashboard:latest -f Containerfile .
# Online backup (web/worker may run): ./deploy/database.sh backup ./backups/2026-09-15.db
# Migrate old host DB BEFORE starting containers:
#   ./deploy/database.sh migrate "$HOME/.config/probelm/dashboard.db"
# Restore without overwriting history:
#   podman compose down
#   ./deploy/database.sh restore ./backups/2026-09-15.db probelm-dashboard-restored
#   PROBE_DATA_VOLUME=probelm-dashboard-restored podman compose up -d
# Persist the chosen volume in .env for subsequent commands. Never delete the old
# volume until recovery is verified. Restore the MATCHING .secrets/master-key too;
# this script never handles keys. Losing that key makes stored credentials unusable.
set -eu
umask 077
image=${PROBE_IMAGE:-localhost/probelm-dashboard:latest}
volume=${PROBE_DATA_VOLUME:-probelm-dashboard-data}
operation=${1:-}
file=${2:-}
if [ -z "$file" ]; then
  echo 'Usage: deploy/database.sh backup DEST | migrate HOST_DB | restore SNAPSHOT NEW_VOLUME' >&2
  exit 1
fi
case "$operation" in
  backup)
    if [ -e "$file" ] || [ -L "$file" ]; then
      echo 'Backup destination already exists; refusing to overwrite.' >&2
      exit 1
    fi
    podman volume exists "$volume"
    mkdir -p "$(dirname -- "$file")"
    temporary=$(mktemp "$(dirname -- "$file")/.probelm-backup.XXXXXX")
    trap 'rm -f "$temporary"' EXIT HUP INT TERM
    podman run --rm --network none --read-only --cap-drop ALL \
      --security-opt no-new-privileges --user 1000:1000 \
      --volume "$volume:/data:U" "$image" \
      node scripts/database-snapshot.mjs backup > "$temporary"
    ln "$temporary" "$file"
    echo "Backup saved: $file (master key must be backed up separately)."
    ;;
  migrate|restore)
    if [ ! -f "$file" ] || [ -L "$file" ]; then
      echo 'Source must be an existing regular database file, not a symlink.' >&2
      exit 1
    fi
    if [ "$operation" = restore ]; then
      volume=${3:?Restore requires an explicit destination volume name}
    fi
    case "$volume" in
      ''|*[!a-zA-Z0-9_.-]*|-*) echo 'Invalid destination volume name.' >&2; exit 1 ;;
    esac
    if [ -n "$(podman ps --filter "volume=$volume" --format '{{.ID}}')" ]; then
      echo 'Stop all containers using the destination volume before importing.' >&2
      exit 1
    fi
    temporary=$(mktemp /tmp/probelm-snapshot.XXXXXX)
    trap 'rm -f "$temporary"' EXIT HUP INT TERM
    # SQLite online backup, NOT a copy of the .db file: includes live committed WAL.
    # sqlite3 is provided by macOS; install your distro sqlite3 package on Linux.
    sqlite3 "$file" '.timeout 10000' ".backup '$temporary'"
    podman volume create --ignore "$volume" > /dev/null
    podman run --rm -i --network none --read-only --cap-drop ALL \
      --security-opt no-new-privileges --user 1000:1000 \
      --volume "$volume:/data:U" "$image" \
      node scripts/database-snapshot.mjs restore < "$temporary"
    echo "Ready: PROBE_DATA_VOLUME=$volume podman compose up -d"
    ;;
  *) echo 'Expected backup, migrate, or restore.' >&2; exit 1 ;;
esac
