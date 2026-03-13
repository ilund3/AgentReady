#!/usr/bin/env bash
# Railway setup: add Postgres and set required variables for AgentReady/Dokploy (cloud mode).
# Run from repo root after: railway link (select or create the project that deploys this repo).
# Requires: Railway CLI (npm i -g @railway/cli), logged in (railway login).

set -e
cd "$(dirname "$0")/.."

echo "Checking Railway CLI..."
if ! command -v railway >/dev/null 2>&1; then
  echo "Install Railway CLI: npm i -g @railway/cli"
  exit 1
fi

echo "Checking project link..."
if ! railway whoami >/dev/null 2>&1; then
  echo "Log in first: railway login"
  exit 1
fi
if ! railway status 2>/dev/null; then
  echo "Link this directory to a project: railway link"
  exit 1
fi

echo ""
echo "Adding Postgres to the project (if not already added)..."
railway add -d postgres || true

echo ""
echo "Setting required variables..."
railway variables set IS_CLOUD=true
railway variables set NODE_ENV=production

# BETTER_AUTH_SECRET: generate if not set
if railway variables get BETTER_AUTH_SECRET 2>/dev/null | grep -q .; then
  echo "BETTER_AUTH_SECRET already set"
else
  SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  railway variables set "BETTER_AUTH_SECRET=$SECRET"
  echo "Set BETTER_AUTH_SECRET (generated)"
fi

echo ""
echo "--- Next steps (do these in Railway Dashboard) ---"
echo "1. Open your project → the service that deploys this repo → Variables."
echo "2. Add: DATABASE_URL = \${{Postgres.DATABASE_URL}}  (reference the Postgres plugin; name may be 'Postgres' or similar)."
echo "3. Add: NEXT_PUBLIC_APP_URL = https://<your-app>.up.railway.app  (use the URL Railway gives your app after deploy)."
echo "4. Redeploy so the new variables are picked up."
echo ""
echo "Done. Deploy with: railway up"
