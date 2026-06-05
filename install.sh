#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Pi Agent Config — One-shot installer
# Works on macOS and Linux
# ──────────────────────────────────────────────

REPO_URL="https://github.com/TeoBale/pi-config.git"
AGENT_DIR="$HOME/.pi/agent"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { printf "${CYAN}→${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${NC} %s\n" "$1"; }
err()   { printf "${RED}✗${NC} %s\n" "$1" >&2; }

# ── 1. Install / reinstall pi ─────────────────
info "Installing (or updating) pi coding agent..."
curl -fsSL https://pi.dev/install.sh | sh
ok "pi is up to date"

# ── 2. Clone (or pull) agent config repo ──────
if [ -d "$AGENT_DIR/.git" ]; then
  info "Config repo exists — pulling latest changes..."
  cd "$AGENT_DIR"
  # Stash local changes (auth.json, sessions, etc.) so pull is clean
  git stash --include-untracked --quiet 2>/dev/null || true
  git pull origin main --rebase --quiet
  # Restore stashed local files
  git stash pop --quiet 2>/dev/null || true
  ok "Config repo updated"
else
  if [ -d "$AGENT_DIR" ]; then
    # Directory exists but is not a git repo — back it up
    BACKUP_DIR="${AGENT_DIR}.bak.$(date +%s)"
    mv "$AGENT_DIR" "$BACKUP_DIR"
    info "Existing ~/.pi/agent backed up to ${BACKUP_DIR}"
  fi
  info "Cloning config repo..."
  git clone "$REPO_URL" "$AGENT_DIR" --quiet
  ok "Config repo cloned to ~/.pi/agent"
fi

# ── Done ───────────────────────────────────────
echo ""
ok "All done! Launch pi with:  pi"
