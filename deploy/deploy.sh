#!/usr/bin/env bash
set -euo pipefail
umask 027
root=/opt/grid-project
revision=${1:?Usage: deploy.sh COMMIT_SHA < image.tar.gz}
[[ $revision =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid revision' >&2; exit 64; }
# shellcheck source=/dev/null
source "$root/deploy.conf"
exec 9>"$root/state/deploy.lock"
flock -w 600 9

old_slot=$(cat "$root/state/active-slot" 2>/dev/null || true)
slot=blue; port=3102
if [[ $old_slot == blue ]]; then slot=green; port=3103; fi
name="grid-project-$slot"
image="grid-project:$revision"
old_include=$(cat "$root/state/active-upstream.conf")
switched=false
committed=false
cleanup() {
  local status=$?
  if [[ $committed != true ]]; then
    if [[ $switched == true ]]; then
      printf '%s\n' "$old_include" > "$root/state/active-upstream.conf.next"
      mv "$root/state/active-upstream.conf.next" "$root/state/active-upstream.conf"
      sudo -n /usr/sbin/nginx -t && sudo -n /usr/sbin/nginx -s reload || true
    fi
    docker rm -f "$name" >/dev/null 2>&1 || true
    echo 'Deployment failed. The previous active container has been preserved.' >&2
  fi
  exit "$status"
}
trap cleanup EXIT

# Transport is an authenticated SSH stdin stream, never a registry credential.
gzip -dc | docker image load
[[ $(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image") == "$revision" ]]
[[ $(docker image inspect --format '{{index .Config.Labels "dev.evarela.app"}}' "$image") == grid-project ]]
docker rm -f "$name" >/dev/null 2>&1 || true
docker network inspect grid-project >/dev/null 2>&1 || docker network create grid-project >/dev/null
docker run -d --name "$name" --restart unless-stopped \
  --network grid-project --publish "127.0.0.1:$port:8080" \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --memory 384m --cpus 1 --pids-limit 128 \
  --log-opt max-size=10m --log-opt max-file=3 \
  --env "APP_ORIGIN=$APP_ORIGIN" "$image" >/dev/null

ready=false
for _ in $(seq 1 40); do
  if curl --fail --silent --max-time 3 "http://127.0.0.1:$port/healthz" | python3 -c 'import json,sys; assert json.load(sys.stdin)["revision"] == sys.argv[1]' "$revision" 2>/dev/null \
    && curl --fail --silent --max-time 10 "http://127.0.0.1:$port/" | grep -i '<html' >/dev/null; then
    ready=true; break
  fi
  sleep 2
done
if [[ $ready != true ]]; then docker logs --tail 30 "$name" >&2; exit 1; fi

printf 'proxy_pass http://127.0.0.1:%s;\n' "$port" > "$root/state/active-upstream.conf.next"
mv "$root/state/active-upstream.conf.next" "$root/state/active-upstream.conf"
switched=true
sudo -n /usr/sbin/nginx -t
sudo -n /usr/sbin/nginx -s reload
for _ in $(seq 1 15); do
  if curl --fail --silent --max-time 3 http://127.0.0.1:3002/healthz | python3 -c 'import json,sys; assert json.load(sys.stdin)["revision"] == sys.argv[1]' "$revision" 2>/dev/null; then
    committed=true; break
  fi
  sleep 1
done
[[ $committed == true ]] || exit 1
printf '%s\n' "$slot" > "$root/state/active-slot"
printf '{"revision":"%s","slot":"%s","url":"%s"}\n' "$revision" "$slot" "$APP_ORIGIN" > "$root/state/current.json.next"
mv "$root/state/current.json.next" "$root/state/current.json"

# Let existing nginx workers finish requests against the previous release.
if [[ -n $old_slot ]]; then sleep 10; docker stop -t 15 "grid-project-$old_slot" >/dev/null || true; fi
echo "Deployed $revision to $slot ($APP_ORIGIN)"
trap - EXIT
