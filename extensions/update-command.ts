/**
 * Update Command Extension
 *
 * Registers a /update command that checks for and applies
 * updates to the pi coding agent itself.
 *
 * Usage:
 *   /update            - Check for pi updates and prompt to apply
 *   /update self       - Update pi only
 *   /update all        - Update pi and all packages (default)
 *   /update --force    - Reinstall pi even if current version is latest
 *
 * Visual feedback:
 *   - Colored widget banner above the editor showing update progress/results
 *   - Persistent footer status indicator
 *   - Toast notifications for each step
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const WIDGET_ID = "pi-update";
const STATUS_ID = "pi-update";

function clearVisuals(ctx: {
	ui: {
		setWidget: (id: string, content?: undefined) => void;
		setStatus: (id: string, status?: undefined) => void;
	};
}) {
	ctx.ui.setWidget(WIDGET_ID, undefined);
	ctx.ui.setStatus(STATUS_ID, undefined);
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("update", {
		description: "Update pi and installed packages",
		getArgumentCompletions: (prefix) => {
			const options = ["self", "all", "--force"];
			const filtered = options.filter((opt) => opt.startsWith(prefix));
			return filtered.length > 0
				? filtered.map((opt) => ({ value: opt, label: opt }))
				: null;
		},
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			const isForce = trimmed.includes("--force");
			const argsClean = trimmed.replace("--force", "").trim();

			// Determine what to update
			const mode =
				argsClean === "self"
					? "self"
					: argsClean === "all" || argsClean === ""
						? "all"
						: null;

			if (!mode) {
				ctx.ui.notify(
					"Usage: /update [self|all] [--force]\n  self  - Update pi only\n  all   - Update pi and all packages (default)",
					"info",
				);
				return;
			}

			// Show a status indicator in the footer while working
			ctx.ui.setStatus(STATUS_ID, "⟳ checking for updates...");

			try {
				const { execSync } = await import("node:child_process");

				// Get current version
				const currentVersion =
					execSync("npm list -g @earendil-works/pi-coding-agent --depth=0 2>/dev/null")
						.toString()
						.trim()
						.split("@")
						.pop() || "unknown";

				ctx.ui.notify(`Current pi version: ${currentVersion}`, "info");

				// Check latest version from pi.dev
				let latestVersion: string | null = null;
				try {
					ctx.ui.setStatus(STATUS_ID, "⟳ checking latest version...");
					const response = await fetch("https://pi.dev/api/latest-version");
					if (response.ok) {
						const data = (await response.json()) as { version?: string };
						latestVersion = data.version ?? null;
						if (latestVersion) {
							ctx.ui.notify(`Latest pi version: ${latestVersion}`, "info");
						}
					}
				} catch {
					ctx.ui.notify("Could not check for latest version (offline?)", "info");
				}

				// Show banner widget above editor with version comparison
				ctx.ui.setWidget(WIDGET_ID, (_tui, theme) => {
					const lines = [
						theme.fg("accent", theme.bold(" ╔══════════════════════════════════╗")),
						theme.fg("accent", theme.bold(" ║         Pi Update Check          ║")),
						theme.fg("accent", theme.bold(" ╚══════════════════════════════════╝")),
						"",
						`  ${theme.fg("dim", "Current:")}  ${theme.fg("muted", currentVersion)}`,
						latestVersion
							? `  ${theme.fg("dim", "Latest:")}   ${theme.fg("success", latestVersion)}`
							: `  ${theme.fg("dim", "Latest:")}   ${theme.fg("warning", "unknown (offline)")}`,
						"",
						theme.fg("dim", "  ────────────────────────────────"),
						"",
						`  ${theme.fg("muted", mode === "self" ? "Update: pi only" : "Update: pi + all packages")}`,
						`  ${theme.fg("dim", "Press confirm to proceed, or Esc to cancel")}`,
						"",
					];
					return new Text(lines.join("\n"), 0, 0);
				});

				// Ask user to confirm
				const label = mode === "self" ? "Update pi itself?" : "Update pi and all packages?";
				const confirmed = await ctx.ui.confirm("Pi Update", label);

				if (!confirmed) {
					clearVisuals(ctx);
					ctx.ui.notify("Update cancelled", "warning");
					return;
				}

				// Switch widget to "updating..." state
				ctx.ui.setWidget(WIDGET_ID, (_tui, theme) => {
					const lines = [
						theme.fg("warning", theme.bold(" ╔══════════════════════════════════╗")),
						theme.fg("warning", theme.bold(" ║        Updating pi...             ║")),
						theme.fg("warning", theme.bold(" ╚══════════════════════════════════╝")),
						"",
						"  " + theme.fg("dim", "Please wait while the update completes."),
						"",
					];
					return new Text(lines.join("\n"), 0, 0);
				});
				ctx.ui.setStatus(STATUS_ID, "⟳ updating pi...");

				// Build command
				let cmd = "pi update";
				if (mode === "self") {
					cmd += " --self";
				}
				if (isForce) {
					cmd += " --force";
				}

				// Execute the update
				const result = execSync(cmd, { encoding: "utf-8", timeout: 120_000 });

				// ---- VISUAL SUCCESS NOTIFICATION ----
				ctx.ui.setStatus(STATUS_ID, "✓ update completed");

				// Show a prominent success banner widget above the editor
				ctx.ui.setWidget(WIDGET_ID, (_tui, theme) => {
					const lines = [
						theme.fg("success", theme.bold(" ╔══════════════════════════════════╗")),
						theme.fg("success", theme.bold(" ║     ✓  Update Completed!         ║")),
						theme.fg("success", theme.bold(" ╚══════════════════════════════════╝")),
						"",
						`  ${theme.fg("success", "✔")}  ${theme.bold("pi has been updated successfully")}`,
						"",
						`  ${theme.fg("dim", "Current:")}  ${theme.fg("muted", currentVersion)}`,
						latestVersion
							? `  ${theme.fg("dim", "Latest:")}   ${theme.fg("success", latestVersion)}`
							: "",
						"",
					];

					// Add output lines if any
					const output = result.trim();
					if (output) {
						lines.push(
							theme.fg("dim", "  ── output ──"),
							"",
							...output.split("\n").map((line) => `  ${theme.fg("dim", line)}`),
							"",
						);
					}

					lines.push(
						theme.fg("dim", "  ────────────────────────────────"),
						"",
						`  ${theme.fg("muted", "Run /reload to apply changes")}`,
						`  ${theme.fg("dim", "The banner will auto-dismiss in 10s")}`,
						"",
					);

					return new Text(lines.join("\n"), 0, 0);
				});

				// Toast notification in the message area
				ctx.ui.notify("✓ pi update completed successfully!", "success");

				// Auto-dismiss the banner after 10 seconds
				setTimeout(() => {
					clearVisuals(ctx);
				}, 10_000);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);

				// Show failure banner
				ctx.ui.setWidget(WIDGET_ID, (_tui, theme) => {
					const lines = [
						theme.fg("error", theme.bold(" ╔══════════════════════════════════╗")),
						theme.fg("error", theme.bold(" ║     ✗  Update Failed!            ║")),
						theme.fg("error", theme.bold(" ╚══════════════════════════════════╝")),
						"",
						`  ${theme.fg("error", "✗")}  ${theme.bold(message)}`,
						"",
						"  Check your network connection and try again.",
						`  ${theme.fg("dim", "The banner will auto-dismiss in 15s")}`,
						"",
					];
					return new Text(lines.join("\n"), 0, 0);
				});

				ctx.ui.setStatus(STATUS_ID, "✗ update failed");
				ctx.ui.notify(`Update failed: ${message}`, "error");

				// Auto-dismiss after 15 seconds
				setTimeout(() => {
					clearVisuals(ctx);
				}, 15_000);
			}
		},
	});
}
