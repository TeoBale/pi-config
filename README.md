# Pi Agent Config

Personal configuration for the [pi coding agent](https://pi.dev).

## Contents

| Path | Description |
|------|-------------|
| `settings.json` | Global pi settings (model, theme, thinking level) |
| `extensions/` | Custom TypeScript extensions (auto-discovered by pi) |

## Extensions

- **`update-command.ts`** — Adds a `/update` command to check for and apply pi updates with visual banner feedback.

## Usage

These configs are auto-discovered by pi from `~/.pi/agent/`. To reload after changes, use `/reload` inside pi.

## Install

```bash
git clone git@github.com:teobale/pi-config.git ~/.pi/agent
```
