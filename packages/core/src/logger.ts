import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Append a timestamped log entry to .steer/state/steer.log.
 */
export function logSteer(message: string, cwd: string): void {
  const stateDir = join(cwd, ".steer", "state");
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });

  const logPath = join(stateDir, "steer.log");
  const timestamp = new Date().toISOString();
  appendFileSync(logPath, `[${timestamp}] ${message}\n`, "utf-8");
}

/**
 * Log an MCP tool call with args summary.
 */
export function logToolCall(toolName: string, args: Record<string, unknown>, cwd: string): void {
  const summary = Object.entries(args)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v.slice(0, 50) : JSON.stringify(v)}`)
    .join(", ");
  logSteer(`TOOL ${toolName}(${summary})`, cwd);
}
