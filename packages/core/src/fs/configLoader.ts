import * as fs from "node:fs";
import * as path from "node:path";
import type { SteerConfig } from "../workflow/types.js";

const DEFAULT_CONFIG: SteerConfig = {
  version: "2.0",
  defaults: {
    branch: "main",
    criticalModules: [],
    testCommand: "npm test",
    lintCommand: "npm run lint",
  },
  modelPolicy: {
    default: "mid",
    criticalModules: "high",
    designMode: "high",
    locThreshold: 300,
    fileCountThreshold: 3,
  },
  codemap: {
    refreshOn: "steer.start",
    strategy: "incremental",
    excludePaths: ["node_modules/", ".git/", "build/", "dist/", "*.min.js"],
  },
};

export function loadConfig(steerDir: string): SteerConfig {
  const configPath = path.join(steerDir, "config.json");
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<SteerConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      defaults: { ...DEFAULT_CONFIG.defaults, ...parsed.defaults },
      modelPolicy: { ...DEFAULT_CONFIG.modelPolicy, ...parsed.modelPolicy },
      codemap: { ...DEFAULT_CONFIG.codemap, ...parsed.codemap },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function loadRules(steerDir: string): string | null {
  const rulesPath = path.join(steerDir, "RULES.md");
  if (!fs.existsSync(rulesPath)) {
    return null;
  }
  try {
    return fs.readFileSync(rulesPath, "utf-8");
  } catch {
    return null;
  }
}

export { DEFAULT_CONFIG };
