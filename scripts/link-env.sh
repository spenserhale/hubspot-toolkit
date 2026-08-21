#!/usr/bin/env sh
# Symlink packages/*/.env -> ../../.env so bun finds it regardless of cwd.
# Idempotent; runs as a postinstall hook.

set -eu

root="$(cd "$(dirname "$0")/.." && pwd)"

for pkg in "$root"/packages/*/; do
  link="${pkg}.env"
  if [ -L "$link" ]; then
    continue
  fi
  if [ -e "$link" ]; then
    echo "link-env: $link exists and is not a symlink; leaving alone" >&2
    continue
  fi
  ln -s ../../.env "$link"
  echo "link-env: linked ${link} -> ../../.env"
done
