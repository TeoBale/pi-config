import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let sessionStartTime: number | null = null;

  pi.on("session_start", async (_event, _ctx) => {
    sessionStartTime = Date.now();
  });

  pi.on("session_shutdown", async (event, ctx) => {
    if (event.reason !== "quit") return;

    const entries = ctx.sessionManager.getEntries();
    const sessionName = ctx.sessionManager.getSessionName();

    // --- Collect stats ---
    let userMessages = 0;
    const toolCalls: Record<string, number> = {};
    let totalTokens = 0;
    let totalCost = 0;
    const modelsUsed = new Set<string>();
    let firstTs: number | null = null;
    let lastTs: number | null = null;

    for (const entry of entries) {
      const ts = typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : entry.timestamp;
      if (ts) {
        if (firstTs === null || ts < firstTs) firstTs = ts;
        if (lastTs === null || ts > lastTs) lastTs = ts;
      }

      if (entry.type === "model_change" && "modelId" in entry && "provider" in entry) {
        modelsUsed.add(`${entry.provider}/${entry.modelId}`);
      }

      if (entry.type === "message" && entry.message) {
        const msg = entry.message;
        if (msg.role === "user") userMessages++;
        if (msg.role === "assistant") {
          if (msg.usage) {
            totalTokens +=
              (msg.usage.input ?? 0) +
              (msg.usage.output ?? 0) +
              (msg.usage.cacheRead ?? 0) +
              (msg.usage.cacheWrite ?? 0);
            totalCost += msg.usage.cost?.total ?? 0;
          }
          if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block && typeof block === "object" && "type" in block && block.type === "toolCall" && "name" in block && typeof block.name === "string") {
                toolCalls[block.name] = (toolCalls[block.name] ?? 0) + 1;
              }
            }
          }
        }
      }
    }

    // Skip if nothing happened
    if (userMessages === 0) return;

    // Duration
    const wallDuration = sessionStartTime ? Date.now() - sessionStartTime : 0;
    const duration = lastTs && firstTs ? lastTs - firstTs : wallDuration;

    // --- Formatters ---
    const fmtDuration = (ms: number): string => {
      if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
      const m = Math.floor(ms / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      if (m < 60) return `${m}m ${s.toString().padStart(2, "0")}s`;
      const h = Math.floor(m / 60);
      return `${h}h ${m % 60}m ${s.toString().padStart(2, "0")}s`;
    };

    const fmtTokens = (t: number): string =>
      t < 1000 ? `${t}` : `${(t / 1000).toFixed(1)}k`;

    const fmtCost = (c: number): string => {
      if (c === 0) return "$0";
      if (c < 0.01) return `$${c.toFixed(4)}`;
      return `$${c.toFixed(2)}`;
    };

    const shortModel = (full: string): string => {
      const id = full.split("/").pop() ?? full;
      return id.replace(/^claude-/, "").replace(/^gpt-/, "").replace(/^gemini-/, "");
    };

    const modelStr =
      modelsUsed.size > 0 ? [...modelsUsed].map(shortModel).join(", ") : "\u2014";
    const totalToolCalls = Object.values(toolCalls).reduce((a, b) => a + b, 0);

    // Top tool types for compact display
    const topTools = Object.entries(toolCalls)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([n]) => n)
      .join(" ");

    // --- ANSI helpers ---
    const S = {
      reset: "\x1b[0m",
      dim: "\x1b[2m",
      bold: "\x1b[1m",
      cyan: "\x1b[36m",
      yellow: "\x1b[33m",
      green: "\x1b[32m",
    };

    const strip = (s: string) => s.replace(/\x1b\[\d*(;\d+)*m/g, "");

    // --- Build content segments ---
    const title = `${S.bold}${S.cyan}${sessionName ? `pi \xb7 ${sessionName}` : "pi session"}${S.reset}`;
    const dur = `${S.dim}${fmtDuration(duration)}${S.reset}`;

    // Metrics: turns | tools | tokens | cost
    const segments: string[] = [];
    segments.push(`${S.yellow}${userMessages}${S.reset} turns`);

    if (totalToolCalls > 0) {
      segments.push(`${S.yellow}${totalToolCalls}${S.reset} tools ${S.dim}(${topTools})${S.reset}`);
    }
    if (totalTokens > 0) {
      segments.push(`${S.yellow}${fmtTokens(totalTokens)}${S.reset} tok`);
    }
    if (totalCost > 0) {
      segments.push(`${S.green}${fmtCost(totalCost)}${S.reset}`);
    }

    const sep = `  ${S.dim}\u2502${S.reset}  `;
    const metricsLine = segments.join(sep);
    const modelInfo = `${S.dim}model: ${modelStr}${S.reset}`;

    // --- Build box ---
    const termWidth = process.stdout.columns || 80;
    const boxW = Math.min(termWidth - 2, 76);

    // Left side of line 1: title · model
    const leftLine1 = `${title} ${S.dim}\xb7${S.reset} ${modelInfo}`;
    const rightLine1 = dur;

    const line2 = metricsLine;

    // Calculate padding (subtract 2 for leading/trailing space inside box)
    const leftW = strip(leftLine1).length;
    const rightW = strip(rightLine1).length;
    const pad1 = Math.max(1, boxW - leftW - rightW - 2);

    const line2W = strip(line2).length;
    const pad2 = Math.max(0, boxW - line2W - 2);

    const edge = `${S.cyan}${S.dim}`;
    const borH = "\u2500".repeat(boxW);

    const out: string[] = [];
    out.push(`\n${edge}\u256d${borH}\u256e${S.reset}`);
    out.push(`${edge}\u2502${S.reset} ${leftLine1}${" ".repeat(pad1)}${rightLine1} ${edge}\u2502${S.reset}`);
    out.push(`${edge}\u2502${S.reset} ${line2}${" ".repeat(pad2)} ${edge}\u2502${S.reset}`);
    out.push(`${edge}\u2570${borH}\u256f${S.reset}\n`);

    process.stdout.write(out.join("\n"));
  });
}
