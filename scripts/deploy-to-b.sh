#!/usr/bin/env bash
set -euo pipefail

revision="${GITHUB_SHA:-$(git rev-parse HEAD)}"
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'Expected a full Git commit SHA' >&2; exit 1; }
[[ -f .deploy-runtime/server/index.js ]] || { echo 'Package production runtime first' >&2; exit 1; }
: "${B_DEPLOY_SSH_KEY:?B_DEPLOY_SSH_KEY must be configured}"
: "${B_DEPLOY_KNOWN_HOSTS:?B_DEPLOY_KNOWN_HOSTS must be configured}"

auth_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/deploy-b.XXXXXX")"
trap 'rm -rf "$auth_dir"' EXIT
chmod 700 "$auth_dir"
printf '%s\n' "$B_DEPLOY_SSH_KEY" > "$auth_dir/key"
printf '%s\n' "$B_DEPLOY_KNOWN_HOSTS" > "$auth_dir/known_hosts"
chmod 600 "$auth_dir/key" "$auth_dir/known_hosts"
cat > "$auth_dir/config" <<EOF
Host experimental-b
  HostName 154.21.197.138
  User web-deploy
  IdentityFile $auth_dir/key
  UserKnownHostsFile $auth_dir/known_hosts
  IdentitiesOnly yes
  BatchMode yes
  StrictHostKeyChecking yes
  ConnectTimeout 15
  ServerAliveInterval 15
  ServerAliveCountMax 3
EOF
export RSYNC_RSH="ssh -F $auth_dir/config"
for app in snake-game; do
  rsync -az -- .deploy-runtime/ "experimental-b:/var/www/$app/releases/.incoming-$revision/"
  ssh -F "$auth_dir/config" experimental-b \
    "sudo -n /usr/local/sbin/deploy-experiments $app $revision"
done
curl --noproxy '*' -fsS --max-time 20 -o /dev/null https://snake.dogeow.com/
curl --noproxy '*' -fsS --max-time 20 https://snake.dogeow.com/health
