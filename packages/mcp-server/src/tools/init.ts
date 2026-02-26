import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { workflow } from "@steer-agent-tool/core";

const { buildCodebaseMap, saveCodebaseMap, DEFAULT_TEMPLATES, DEFAULT_RULES, DEFAULT_HOOKS_YAML, DEFAULT_CONFIG } = workflow;

export const InitParamsSchema = {
  repoPath: z.string().describe("Absolute path to the repository root"),
  team: z.string().optional().describe("Team name"),
  criticalModules: z.array(z.string()).optional().describe("Critical module paths (e.g. payments/, auth/)"),
  testCommand: z.string().optional().describe("Test command (default: npm test)"),
  lintCommand: z.string().optional().describe("Lint command (default: npm run lint)"),
};

export async function handleInit(args: {
  repoPath: string;
  team?: string;
  criticalModules?: string[];
  testCommand?: string;
  lintCommand?: string;
}) {
  try {
    const steerDir = path.join(args.repoPath, ".steer");

    // Create directory structure
    const dirs = [
      steerDir,
      path.join(steerDir, "templates"),
      path.join(steerDir, "state"),
    ];
    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write config.json
    const config = {
      ...DEFAULT_CONFIG,
      team: args.team,
      defaults: {
        ...DEFAULT_CONFIG.defaults,
        criticalModules: args.criticalModules ?? [],
        testCommand: args.testCommand ?? DEFAULT_CONFIG.defaults.testCommand,
        lintCommand: args.lintCommand ?? DEFAULT_CONFIG.defaults.lintCommand,
      },
    };
    fs.writeFileSync(
      path.join(steerDir, "config.json"),
      JSON.stringify(config, null, 2),
      "utf-8",
    );

    // Write RULES.md
    fs.writeFileSync(path.join(steerDir, "RULES.md"), DEFAULT_RULES, "utf-8");

    // Write hooks.yaml
    fs.writeFileSync(path.join(steerDir, "hooks.yaml"), DEFAULT_HOOKS_YAML, "utf-8");

    // Write default templates
    for (const [filename, content] of Object.entries(DEFAULT_TEMPLATES)) {
      fs.writeFileSync(path.join(steerDir, "templates", filename), content, "utf-8");
    }

    // Write .gitignore for state/ dir
    const gitignorePath = path.join(steerDir, ".gitignore");
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, "state/\nembeddings/\n", "utf-8");
    }

    // Build codebase map
    const map = buildCodebaseMap(args.repoPath, config);
    saveCodebaseMap(steerDir, map);

    const moduleCount = Object.keys(map.modules).length;
    const fileCount = Object.values(map.modules).reduce(
      (acc, mod) => acc + Object.keys(mod.files).length,
      0,
    );

    const result = {
      status: "initialized",
      steerDir,
      created: [
        "config.json",
        "RULES.md",
        "hooks.yaml",
        "templates/ (5 templates)",
        "state/ (gitignored)",
        "codebase-map.json",
      ],
      codemap: {
        modules: moduleCount,
        files: fileCount,
        language: map.language ?? "unknown",
        buildSystem: map.buildSystem ?? "unknown",
      },
      message: `SteerAgent initialized. ${fileCount} files in ${moduleCount} modules mapped.`,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
      isError: true,
    };
  }
}
