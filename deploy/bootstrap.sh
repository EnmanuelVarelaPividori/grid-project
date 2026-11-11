#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run with sudo on hiqual.' >&2; exit 1; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root=/opt/grid-project
install -d -o manu -g manu -m 750 "$root" "$root/state"
install -d -o root -g root -m 755 "$root/bin"
install -o root -g root -m 755 "$source_dir/deploy.sh" "$root/bin/deploy.sh"
install -o root -g root -m 755 "$source_dir/ssh-entrypoint.sh" "$root/bin/ssh-entrypoint.sh"
if [[ ! -f $root/deploy.conf ]]; then
  printf 'APP_ORIGIN=https://aigrunn.evarela.dev\n' > "$root/deploy.conf"
  chmod 644 "$root/deploy.conf"
fi
if [[ ! -f $root/state/active-upstream.conf ]]; then
  printf 'proxy_pass http://127.0.0.1:3102;\n' > "$root/state/active-upstream.conf"
  chown manu:manu "$root/state/active-upstream.conf"
fi
install -o root -g root -m 644 "$source_dir/nginx.conf" /etc/nginx/sites-available/grid-project.conf
ln -sfn /etc/nginx/sites-available/grid-project.conf /etc/nginx/sites-enabled/grid-project.conf
nginx -t
nginx -s reload
echo 'Origin ready at http://192.168.178.39:3002; awaiting the first application image.'
