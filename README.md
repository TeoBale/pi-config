# Pi Agent Config

Personal configuration for the [pi coding agent](https://pi.dev).

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/TeoBale/pi-config/main/install.sh | sh
```

This single command will:
1. Install or update **pi** via `pi.dev`
2. Clone (or pull) this config repo to `~/.pi/agent`

> Works on **macOS** and **Linux**.

## Contents

| Path | Description |
|------|-------------|
| `settings.json` | Global pi settings (model, theme, thinking level) |
| `extensions/` | Custom TypeScript extensions (auto-discovered by pi) |
| `install.sh` | One-shot install script |

## Extensions

- **`update-command.ts`** — Adds a `/update` command to check for and apply pi updates with visual banner feedback.
- **`session-summary.ts`** — Session summary utilities.
- **`skills-command.ts`** — Adds a `/skills` command.
- **`startup-header.ts`** — Custom startup header display.

## Usage

These configs are auto-discovered by pi from `~/.pi/agent/`. To reload after changes, use `/reload` inside pi.
