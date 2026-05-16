/**
 * Skills Command Extension
 *
 * Registers a /skills command that lists all installed skills with checkboxes,
 * allowing you to enable/disable which skills are available to the agent at any time.
 *
 * Features:
 *   - Lists all discovered skills with toggle states
 *   - Real-time filtering by typing (fuzzy search)
 *   - Keyboard navigation (↑↓ to navigate, space/enter to toggle, esc to close)
 *   - Persists your skill preferences across sessions and branch navigation
 *
 * Usage:
 *   /skills          - Open the skill selector
 *   /skills search   - Open with search pre-focused
 */

import type { ExtensionAPI, SlashCommandInfo } from "@earendil-works/pi-coding-agent";
import { formatSkillsForPrompt, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import type { Skill } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@earendil-works/pi-tui";

// State persisted to session entries
interface SkillsState {
	enabledSkills: string[];
}

export default function (pi: ExtensionAPI) {
	// ── State ──────────────────────────────────────────────────────────

	let enabledSkills: Set<string> = new Set();
	let allSkillNames: string[] = [];

	// Persist current skill selection to session
	function persistState() {
		pi.appendEntry<SkillsState>("skills-config", {
			enabledSkills: Array.from(enabledSkills),
		});
	}

	// Rebuild the active skills set from persisted state
	function restoreState() {
		// Discover skill names from registered commands
		const skillCommands = pi
			.getCommands()
			.filter((c): c is SlashCommandInfo & { source: "skill" } => c.source === "skill");

		allSkillNames = skillCommands.map((c) => c.name);

		// Start with all disabled by default — user must explicitly enable
		enabledSkills = new Set<string>();
	}

	// ── System prompt filtering ────────────────────────────────────────

	// Regex to find the <available_skills>...</available_skills> block
	// including the preceding newlines/trailing whitespace.
	const SKILLS_BLOCK_RE = /\n\n<available_skills>[\s\S]*?<\/available_skills>\n*/;

	pi.on("before_agent_start", async (event, ctx) => {
		if (enabledSkills.size === allSkillNames.length) {
			// All skills enabled — nothing to filter
			return;
		}

		const allSkills: Skill[] = event.systemPromptOptions?.skills ?? [];
		const filtered = allSkills.filter((s) => enabledSkills.has(`skill:${s.name}`));

		if (filtered.length === allSkills.length) {
			// No effective change
			return;
		}

		// Build new skills block and replace in system prompt
		const newSkillsBlock = filtered.length > 0 ? `\n\n${formatSkillsForPrompt(filtered)}` : "";
		const newPrompt = event.systemPrompt.replace(SKILLS_BLOCK_RE, newSkillsBlock);

		if (newPrompt !== event.systemPrompt) {
			return { systemPrompt: newPrompt };
		}
	});

	// ── UI: SettingsList with filtering ────────────────────────────────

	pi.registerCommand("skills", {
		description: "Enable/disable installed skills",
		handler: async (_args, ctx) => {
			// Refresh skill list
			restoreState();

			// Build SettingItems for the SettingsList
			const skillCommands = pi
				.getCommands()
				.filter((c): c is SlashCommandInfo & { source: "skill" } => c.source === "skill");

			const items: SettingItem[] = skillCommands.map((cmd) => {
				// Strip "skill:" prefix for display
				const displayName = cmd.name.startsWith("skill:") ? cmd.name.slice(6) : cmd.name;
				return {
					id: cmd.name,
					label: displayName,
					currentValue: enabledSkills.has(cmd.name) ? "enabled" : "disabled",
					values: ["enabled", "disabled"],
				};
			});

			// Track if anything changed so we can notify
			let changed = false;

			await ctx.ui.custom((tui, theme, _kb, done) => {
				const container = new Container();

				// Title
				container.addChild(
					new Text(
						[
							theme.fg("accent", theme.bold(" ╔══════════════════════════════════════╗")),
							theme.fg("accent", theme.bold(" ║           Skill Configuration        ║")),
							theme.fg("accent", theme.bold(" ╚══════════════════════════════════════╝")),
							"",
						].join("\n"),
						1,
						0,
					),
				);

				// SettingsList with search enabled
				const settingsList = new SettingsList(
					items,
					Math.min(items.length + 2, 18),
					getSettingsListTheme(),
					(id, newValue) => {
						// Toggle skill on/off
						if (newValue === "enabled") {
							enabledSkills.add(id);
						} else {
							enabledSkills.delete(id);
						}
						changed = true;
						persistState();
					},
					() => done(undefined), // Close
					{ enableSearch: true },
				);

				container.addChild(settingsList);

				// Footer help text
				container.addChild(
					new Text(
						[
							"",
							theme.fg("dim", "  Type to filter skills • ↑↓ navigate • space/enter toggle • esc done"),
							"",
						].join("\n"),
						1,
						0,
					),
				);

				return {
					render: (w: number) => container.render(w),
					invalidate: () => container.invalidate(),
					handleInput: (data: string) => {
						settingsList.handleInput?.(data);
						tui.requestRender();
					},
				};
			});

			// Notify result
			if (changed) {
				const count = enabledSkills.size;
				ctx.ui.notify(
					`${count} skill${count === 1 ? "" : "s"} enabled`,
					count > 0 ? "success" : "warning",
				);
			}
		},
	});

	// ── Session lifecycle ──────────────────────────────────────────────

	function restoreFromBranch(ctx: { sessionManager: { getBranch: () => Array<{ type: string; customType?: string; data?: unknown }> } }) {
		restoreState();

		// Walk branch entries to find last saved config
		const branchEntries = ctx.sessionManager.getBranch();
		for (const entry of branchEntries) {
			if (entry.type === "custom" && entry.customType === "skills-config") {
				const data = (entry.data as SkillsState | undefined);
				if (data?.enabledSkills) {
					// Only keep skills that still exist
					enabledSkills = new Set(
						data.enabledSkills.filter((s) => allSkillNames.includes(s)),
					);
				}
			}
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		restoreFromBranch(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		restoreFromBranch(ctx);
	});
}
