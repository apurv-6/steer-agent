import { steerDirExists } from "@steer-agent-tool/core";
import { readFileSync } from "node:fs";

/**
 * SteerAgent UserPromptSubmit Hook
 *
 * RULE: MUST exit(0) on ANY error. NEVER block the user.
 * If .steer/ is missing → silent pass-through.
 * If anything throws → pass-through.
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

  // Pass through — detailed scoring handled by steer.gate MCP tool
  process.stdout.write(JSON.stringify({ result: "pass" }));
  process.exit(0);
} catch {
  // ANY error → pass through, NEVER block the developer
  process.stdout.write(JSON.stringify({ result: "pass" }));
  process.exit(0);
}
