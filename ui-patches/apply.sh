#!/bin/bash
# Apply pi UI patches after a pi update
# Uses patch-package for node_modules deps + standard patch for pi's own files.
#
# Run this after `pi update --self` or `npm install -g @earendil-works/pi-coding-agent`

set -e

# Resolve pi install directory
PI_BIN="$(which pi)"
PI_REAL="$(readlink -f "$PI_BIN" 2>/dev/null || realpath "$PI_BIN" 2>/dev/null || echo "$PI_BIN")"
PI_AGENT_DIR="$(dirname "$(dirname "$PI_REAL")")"
PI_TUI_DIR="${PI_AGENT_DIR}/node_modules/@earendil-works/pi-tui"

PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$PI_AGENT_DIR" ]; then
    echo "Error: pi-coding-agent not found at $PI_AGENT_DIR"
    exit 1
fi

echo "Applying UI patches..."

# --- pi-tui patches (via patch-package) ---
# Copy patch into the project's patches/ directory for patch-package
mkdir -p "$PI_AGENT_DIR/patches"
PI_TUI_PATCH="${PATCH_DIR}/patches/@earendil-works+pi-tui+0.78.1.patch"
if [ -f "$PI_TUI_PATCH" ]; then
    cp "$PI_TUI_PATCH" "$PI_AGENT_DIR/patches/"
    (cd "$PI_AGENT_DIR" && npx patch-package) || echo "  pi-tui patch failed (version mismatch?)"
else
    echo "  Warning: pi-tui patch not found at $PI_TUI_PATCH"
fi

# --- interactive-mode patch (standard patch) ---
IM_PATCH="${PATCH_DIR}/patches/interactive-mode.patch"
if [ -f "$IM_PATCH" ]; then
    patch -p0 --forward --silent "$PI_AGENT_DIR/dist/modes/interactive/interactive-mode.js" < "$IM_PATCH" 2>/dev/null || true
fi

# Clean up patches directory from pi-agent (don't leave clutter)
rm -f "$PI_AGENT_DIR/patches/@earendil-works+pi-tui+"*.patch 2>/dev/null || true
rmdir "$PI_AGENT_DIR/patches" 2>/dev/null || true

echo ""
echo "Patches applied. Restart pi to see changes."
echo ""
echo "What was patched:"
echo "  • Autocomplete list rendered ABOVE the editor (not below)"
echo "  • Custom word navigation (Ctrl+Left / Ctrl+Right)"
echo "  • GitHub Copilot OAuth polling message"
echo ""
echo "Extensions loaded from ~/.pi/agent/extensions/:"
echo "  • startup-header.ts — Centered ASCII logo on new sessions"
echo ""
echo "Config repo: https://github.com/TeoBale/pi-config"
