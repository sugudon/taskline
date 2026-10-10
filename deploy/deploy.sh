#!/usr/bin/env bash
# Deploy Taskline to a VPS over SSH.
#
#   deploy/deploy.sh root@<vps-ip> [acme-email]
#
# First run: installs Docker (if missing), uploads the code to /opt/taskline,
# generates /opt/taskline/.env.production with random secrets, builds and starts the stack.
# Later runs: re-upload code and rebuild; the existing .env.production and database are kept.
set -euo pipefail

TARGET="${1:?usage: deploy/deploy.sh user@host [acme-email]}"
ACME_EMAIL="${2:-}"
DOMAIN="${DOMAIN:-taskline.sugunajayaram.tech}"
REMOTE_DIR="${REMOTE_DIR:-/opt/taskline}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Checking SSH access to $TARGET"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$TARGET" true

echo "==> Ensuring Docker is installed on the server"
ssh "$TARGET" 'command -v docker >/dev/null 2>&1 || (curl -fsSL https://get.docker.com | sh)'
ssh "$TARGET" "mkdir -p '$REMOTE_DIR'"

echo "==> Uploading code to $REMOTE_DIR"
rsync -az --delete \
  --exclude '.env' --exclude '.env.production' --exclude 'backend/.env' \
  --exclude 'node_modules' --exclude '.venv' --exclude 'dist' --exclude 'coverage' \
  --exclude '__pycache__' --exclude '.mypy_cache' --exclude '.ruff_cache' --exclude '.pytest_cache' \
  --exclude '*.db' --exclude '.DS_Store' --exclude '.git' \
  "$ROOT/" "$TARGET:$REMOTE_DIR/"

echo "==> Creating .env.production (only if missing)"
ssh "$TARGET" "cd '$REMOTE_DIR' && if [ ! -f .env.production ]; then
  [ -n '$ACME_EMAIL' ] || { echo 'First deploy needs an ACME email: deploy/deploy.sh $TARGET you@example.com' >&2; exit 1; }
  sed -e 's|^DOMAIN=.*|DOMAIN=$DOMAIN|' \
      -e 's|^ACME_EMAIL=.*|ACME_EMAIL=$ACME_EMAIL|' \
      -e \"s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=\$(openssl rand -hex 24)|\" \
      -e \"s|^SECRET_KEY=.*|SECRET_KEY=\$(openssl rand -hex 32)|\" \
      deploy/.env.production.example > .env.production
  chmod 600 .env.production
  echo 'Created .env.production with generated secrets'
fi"

echo "==> Building and starting the stack"
ssh "$TARGET" "cd '$REMOTE_DIR' && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --remove-orphans"

echo "==> Waiting for https://$DOMAIN/health"
for _ in $(seq 1 60); do
  if curl -fsS "https://$DOMAIN/health" >/dev/null 2>&1; then
    echo "Live: https://$DOMAIN"
    exit 0
  fi
  sleep 5
done
echo "Health check did not pass yet. Inspect with:" >&2
echo "  ssh $TARGET 'cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml ps && docker compose -f docker-compose.prod.yml logs --tail 50'" >&2
exit 1
