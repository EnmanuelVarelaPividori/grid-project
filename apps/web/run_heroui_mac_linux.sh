#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
pnpm --filter @gridshare/web build
python3 apps/web/app.py --open
