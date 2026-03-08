import { steerDirExists, gate, findSteerDir } from "@steer-agent-tool/core";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * SteerAgent UserPromptSubmit Hook
 *
 * RULE: MUST exit(0) on ANY error. NEVER block the user.
 * If .steer/ is missing → silent pass-through.
 * If anything throws → pass-through.
 *
 * Flow:
 *   1. Read prompt from stdin (Claude Code hook payload)
 *   2. Call gate() to score the prompt
 *   3. Write result to .steer/last-gate.json (extension bridge file)
 *   4. Always exit(0) — never block the developer
 */

try {
  // Read hook input from stdin
  let raw = "{}";
  try { raw = readFileSync("/dev/stdin", "utf8"); } catch {}

  let input: Record<string, unknown> = {};
  try { input = JSON.parse(raw); } catch {}

  // Silent pass-through for projects without .steer/
  if (!steerDirExists()) {
    process.stdout.write(JSON.stringify({ result: "pass" }));
    process.exit(0);
  }

  const prompt = typeof input.prompt === "string" ? input.prompt : "";

  if (!prompt.trim()) {
    process.stdout.write(JSON.stringify({ result: "pass" }));
    process.exit(0);
  }

  // Read mode from .steer/config.json (default: "dev")
  let mode: "dev" | "debug" | "bugfix" | "design" | "refactor" = "dev";
  try {
    const steerDir = findSteerDir();
    const configRaw = readFileSync(join(steerDir, "config.json"), "utf8");
    const config = JSON.parse(configRaw);
    const validModes = ["dev", "debug", "bugfix", "design", "refactor"];
    if (typeof config.mode === "string" && validModes.includes(config.mode)) {
      mode = config.mode as typeof mode;
    }
  } catch {}

  // Score the prompt
  const gateResult = gate({ draftPrompt: prompt, mode });

  // Write bridge file for the extension's file watcher
  try {
    const steerDir = findSteerDir();
    const stateDir = join(steerDir, "state");
    mkdirSync(stateDir, { recursive: true });

    const bridgePayload = {
      timestamp: Date.now(),
      draftPrompt: prompt,
      gateResult,
      mode,
    };

    writeFileSync(join(steerDir, "last-gate.json"), JSON.stringify(bridgePayload, null, 2));
  } catch {
    // Writing bridge file is best-effort — never block the user
  }

  // Always pass through — never block the developer
  process.stdout.write(JSON.stringify({ result: "pass" }));
  process.exit(0);
} catch {
  // ANY error → pass through, NEVER block the developer
  process.stdout.write(JSON.stringify({ result: "pass" }));
  process.exit(0);
}
