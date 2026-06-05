/**
 * startup-header.ts — Custom startup header with ASCII logo + vertical centering.
 *
 * Replaces the built-in header with a centered ASCII art "PI" logo
 * on new sessions, plus compact keybinding hints. Once messages appear,
 * reverts to the built-in header.
 */

import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

const PI_ASCII_LOGO = [
  "██████╗ ██╗",
  "██╔══██╗██║",
  "██████╔╝██║",
  "██╔═══╝ ██║",
  "██║     ██║",
  "╚═╝     ╚═╝",
];

function getLogoLines(theme: Theme): string[] {
  return [
    ...PI_ASCII_LOGO.map((line) => theme.fg("thinkingOff", line)),
    theme.fg("dim", `v${VERSION}`),
    "",
    theme.fg("muted", "Type a message and press Enter to start"),
    theme.fg("muted", "Esc to cancel  •  Ctrl+C to clear  •  /hotkeys for all shortcuts"),
  ];
}

export default function (pi: ExtensionAPI) {
  let headerActive = false;

  pi.on("session_start", async (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    const entries = ctx.sessionManager.getEntries();
    const hasMessages = entries.some(
      (e) => e.type === "message" && e.role !== undefined
    );

    if (!hasMessages && !headerActive) {
      headerActive = true;

      ctx.ui.setHeader((_tui, theme) => ({
        render(width: number): string[] {
          const termHeight = process.stdout.rows || 24;
          const reservedBottom = 9; // editor + autocomplete + footer
          const lines = getLogoLines(theme);
          const contentHeight = lines.length;
          const availableHeight = Math.max(termHeight - reservedBottom, 1);
          const topPad = Math.max(1, Math.floor((availableHeight - contentHeight) / 2));

          const result: string[] = [];
          for (let i = 0; i < topPad; i++) result.push("");
          for (const line of lines) {
            const lineW = visibleWidth(line);
            const leftPad = Math.max(0, Math.floor((width - lineW) / 2));
            result.push(" ".repeat(leftPad) + line);
          }
          return result;
        },
        invalidate() {},
      }));
    }
  });

  // Once user sends first message, restore default header
  pi.on("message_start", async (event, ctx) => {
    if (headerActive && event.message.role === "user") {
      headerActive = false;
      ctx.ui.setHeader(undefined);
    }
  });
}
