#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
SCRAPER_VENV="${SCRAPER_VENV:-$BACKEND_DIR/scraping-venv}"
PYTHON_BIN="$SCRAPER_VENV/bin/python"

export SOCCERDATA_DIR="${SOCCERDATA_DIR:-$BACKEND_DIR/downloaded_files/soccerdata}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  python3 -m venv "$SCRAPER_VENV"
  "$PYTHON_BIN" -m pip install --upgrade pip
  "$PYTHON_BIN" -m pip install -r "$BACKEND_DIR/requirements-scrape.txt"
fi

cd "$BACKEND_DIR"
"$PYTHON_BIN" commands.py scrape-data

cd "$ROOT_DIR"
git add backend/modelling/data

if git diff --cached --quiet -- backend/modelling/data; then
  echo "No data changes to commit."
  exit 0
fi

git commit -m "Update football data" -- backend/modelling/data
git push origin main
