import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { TelemetryEvent } from "./types.js";

export async function append(
  data: Record<string, unknown>,
  filePath: string,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const line = JSON.stringify(data) + "\n";
  await appendFile(filePath, line, "utf-8");
}
