import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { buildCodebaseMap } from "@steer-agent-tool/core";

export const MapSchema = {
  action: z.enum(["rebuild", "query"]).optional().describe("Rebuild the map or query it (default: query)"),
  query: z.string().optional().describe("Module or file to query"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleMap(args: { action?: string; query?: string; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();
    const action = args.action || "query";
    const mapPath = join(cwd, ".steer", "codebase-map.json");

    if (action === "rebuild") {
      const map = await buildCodebaseMap(cwd);
      writeFileSync(mapPath, JSON.stringify(map, null, 2));
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "rebuilt",
            modules: Object.keys(map.modules).length,
            files: Object.keys(map.files).length,
          }, null, 2),
        }],
      };
    }

    // Query mode
    if (!existsSync(mapPath)) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "No codebase map. Run steer.init or steer.map with action=rebuild." }) }],
        isError: true,
      };
    }

    const map = JSON.parse(readFileSync(mapPath, "utf-8"));
    if (args.query) {
      const module = map.modules[args.query];
      const file = map.files[args.query];
      const deps = map.dependencies[args.query];
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ query: args.query, module, file, dependencies: deps }, null, 2),
        }],
      };
    }

    // Summary
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          root: map.root,
          modules: Object.keys(map.modules),
          fileCount: Object.keys(map.files).length,
        }, null, 2),
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}
