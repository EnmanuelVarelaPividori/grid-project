#!/usr/bin/env bash
set -euo pipefail
# This key can only deliver a versioned image or read deployment status.
if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy[[:space:]]([a-f0-9]{40})$ ]]; then
  exec /opt/grid-project/bin/deploy.sh "${BASH_REMATCH[1]}"
elif [[ ${SSH_ORIGINAL_COMMAND:-} == status ]]; then
  cat /opt/grid-project/state/current.json
else
  echo 'Only deploy <40-character-commit-sha> or status is permitted.' >&2
  exit 64
fi
