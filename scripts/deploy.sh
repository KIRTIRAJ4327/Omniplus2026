#!/usr/bin/env bash
# One-time setup: creates a GitHub repo, links a Vercel project, sets HOST_PIN, deploys.
# Needs: git, GitHub CLI (gh auth login), Vercel CLI (vercel login).
set -euo pipefail
REPO="${1:-pulse-check}"
cd "$(dirname "$0")/.."

command -v gh >/dev/null || { echo "Install the GitHub CLI first: https://cli.github.com, then run: gh auth login"; exit 1; }
command -v vercel >/dev/null || npm i -g vercel

[ -d .git ] || git init -b main
git add -A
git commit -m "Pulse Check for Omni Pulse Tech 2026" >/dev/null 2>&1 || true
if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$REPO" --private --source=. --push
else
  git push -u origin main
fi

vercel link --yes
vercel git connect --yes || true

read -r -s -p "Choose a host PIN for the projector screen: " PIN; echo
printf "%s" "$PIN" | vercel env add HOST_PIN production >/dev/null || echo "HOST_PIN already set; change it in Vercel > Settings > Environment Variables."

echo
echo "Now connect a database (one time):"
echo "  Vercel dashboard > your project > Storage > Create Database > Neon > Connect."
echo "  That adds DATABASE_URL automatically. Tables and questions are created on first use."
read -r -p "Press Enter once the database is connected... "

vercel --prod
echo "Done. Players: your Vercel URL.  Projector: <your URL>/host"
