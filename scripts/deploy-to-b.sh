#!/usr/bin/env bash
set -euo pipefail

validate_only="${VALIDATE_ONLY:-false}"
[[ "$validate_only" = true || "$validate_only" = false ]] || { echo 'Expected a boolean validation mode' >&2; exit 1; }

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
if [ "$validate_only" = true ]; then
  for app in snake-game; do
    ssh -F "$auth_dir/config" experimental-b "check $app" > "$auth_dir/check.json"
    python3 - "$auth_dir/check.json" "$app" <<'PY_CHECK'
import json,sys
value=json.load(open(sys.argv[1]))
assert value.get('check_ok') is True and value.get('application')==sys.argv[2]
assert value.get('publication_or_restart_performed') is False
PY_CHECK
  done
  for denied_command in 'sh' 'cat /etc/ssh/ssh_host_ed25519_key' 'systemctl restart squid.service' "sudo -n /usr/local/sbin/deploy-experiments upyun-web $revision"; do
    status=0
    ssh -F "$auth_dir/config" experimental-b "$denied_command" > "$auth_dir/denied.json" 2> "$auth_dir/denied.stderr" || status=$?
    [[ "$status" = 1 ]] || { echo 'Expected the actual forced gateway to reject the command' >&2; exit 1; }
    python3 - "$auth_dir/denied.json" <<'PY_DENIED'
import json,sys
value=json.load(open(sys.argv[1]))
assert value.get('experiment_gateway_ok') is False and value.get('scope_or_validation_rejected') is True
PY_DENIED
  done
  echo 'B fixed endpoint verified: only original three apps; shell/private path/other service denied; no upload/restart'
else
  for app in snake-game; do
    rsync -az -- .deploy-runtime/ "experimental-b:/var/www/$app/releases/.incoming-$revision/"
    ssh -F "$auth_dir/config" experimental-b \
      "sudo -n /usr/local/sbin/deploy-experiments $app $revision"
  done
fi
curl --noproxy '*' -fsS --max-time 20 -o /dev/null https://snake.dogeow.com/
curl --noproxy '*' -fsS --max-time 20 https://snake.dogeow.com/health
