import * as path from "node:path";
import { z } from "zod";
import { workflow } from "@steer-agent-tool/core";

const { buildCodebaseMap, saveCodebaseMap, loadConfig } = workflow;

export const MapParamsSchema = {
  repoPath: z.string().describe("Absolute path to the repository root"),
  force: z.boolean().optional().describe("Force full rebuild (default: false)"),
};

export async function handleMap(args: { repoPath: string; force?: boolean }) {
  try {
    const steerDir = path.join(args.repoPath, ".steer");
    const config = loadConfig(steerDir);

    const map = buildCodebaseMap(args.repoPath, config);
    saveCodebaseMap(steerDir, map);

    const moduleCount = Object.keys(map.modules).length;
    const fileCount = Object.values(map.modules).reduce(
      (acc, mod) => acc + Object.keys(mod.files).length,
      0,
    );

    const depCount = Object.values(map.dependencies).reduce(
      (acc, dep) => acc + dep.imports.length,
      0,
    );

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "mapped",
          modules: moduleCount,
          files: fileCount,
          dependencies: depCount,
          language: map.language,
          buildSystem: map.buildSystem,
          hasCoupling: !!map.changeCoupling && Object.keys(map.changeCoupling).length > 0,
          hasOwnership: !!map.ownership && Object.keys(map.ownership).length > 0,
          message: `Codebase map rebuilt: ${fileCount} files, ${moduleCount} modules, ${depCount} dependency links.`,
        }, null, 2),
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
      isError: true,
    };
  }
}
