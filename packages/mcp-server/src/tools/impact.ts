import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { computeImpact } from "@steer-agent-tool/core";

export const ImpactSchema = {
  files: z.array(z.string()).describe("Files to analyze impact for"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleImpact(args: { files: string[]; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();

    const mapPath = join(cwd, ".steer", "codebase-map.json");
    const codemap = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, "utf-8")) : undefined;

    const impact = computeImpact(args.files, codemap);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ impact }, null, 2) }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}
