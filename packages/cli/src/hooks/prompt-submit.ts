import { steerDirExists } from "@steer-agent-tool/core";
import { readFileSync } from "node:fs";

// Read hook input from stdin
function readStdin(): string {
  try {
    return readFileSync("/dev/stdin", "utf8");
  } catch {
    return "{}";
  }
}

const raw = readStdin();
let input: Record<string, unknown> = {};
try {
  input = JSON.parse(raw);
} catch {
  // malformed input — pass through
}

// Silent pass-through for projects without .steer/
if (!steerDirExists()) {
  process.exit(0);
}

// SteerAgent project: run basic gate check
// For now, always pass — the MCP-based gate handles scoring
// This hook is a placeholder for future threshold enforcement
const prompt = typeof input.prompt === "string" ? input.prompt : "";

if (!prompt.trim()) {
  process.exit(0);
}

// Pass through — detailed scoring handled by steer.gate MCP tool
process.stdout.write(JSON.stringify({ result: "pass" }));
process.exit(0);
