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

# --- pi-tui patches ---
# Auto-detect pi-tui version and find matching patch
PI_TUI_VERSION=$(node -e "try{console.log(require('${PI_AGENT_DIR}/node_modules/@earendil-works/pi-tui/package.json').version)}catch(e){}" 2>/dev/null || echo "")
if [ -n "$PI_TUI_VERSION" ]; then
    PI_TUI_PATCH="${PATCH_DIR}/patches/@earendil-works+pi-tui+${PI_TUI_VERSION}.patch"
    if [ ! -f "$PI_TUI_PATCH" ]; then
        # Fallback: try the latest available pi-tui patch (sorted by version)
        PI_TUI_PATCH=$(ls -1 "${PATCH_DIR}/patches/@earendil-works+pi-tui+"*.patch 2>/dev/null | sort -V | tail -1)
    fi
    if [ -n "$PI_TUI_PATCH" ] && [ -f "$PI_TUI_PATCH" ]; then
        echo "  Applying pi-tui patch: $(basename "$PI_TUI_PATCH")"
        # Try exact match first, then with fuzz factor for version bumps
        if ! patch --dry-run -p1 --forward --silent -d "$PI_AGENT_DIR" < "$PI_TUI_PATCH" 2>/dev/null; then
            echo "  (patch already applied or needs regeneration for ${PI_TUI_VERSION})"
        else
            patch -p1 --forward --silent -d "$PI_AGENT_DIR" < "$PI_TUI_PATCH" 2>/dev/null && echo "  pi-tui patch applied" || echo "  pi-tui patch failed"
        fi
    else
        echo "  Warning: no pi-tui patch available (installed: ${PI_TUI_VERSION})"
        echo "  Run /update and check ~/.pi/agent/ui-patches/patches/ for available patches"
    fi
else
    echo "  Warning: could not detect pi-tui version"
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
echo "UI patches applied. Restart pi to see changes."
echo ""
echo "What was patched:"
echo "  • Autocomplete list rendered ABOVE the editor (not below)"
echo "  • Custom word navigation (Ctrl+Left / Ctrl+Right)"
echo "  • GitHub Copilot OAuth polling message"
echo "  • Gray input bar background (Cursor CLI style)"
echo "  • Editor anchored to bottom"
echo ""
echo "To regenerate patches after a pi-tui version bump:"
echo "  1. Install clean version: npm install -g @earendil-works/pi-coding-agent"
echo "  2. Apply changes manually"
echo "  3. Generate patch: diff -u original patched > patches/@earendil-works+pi-tui+X.Y.Z.patch"
echo ""
echo "Config repo: https://github.com/TeoBale/pi-config"
