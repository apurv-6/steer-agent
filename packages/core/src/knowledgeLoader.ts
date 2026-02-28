import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { KnowledgeEntry } from "./types.js";

/**
 * Load knowledge files for affected modules.
 * Reads .steer/knowledge/{module}.md for each module name.
 */
export function loadModuleKnowledge(
  modules: string[],
  cwd: string,
): KnowledgeEntry[] {
  const knowledgeDir = join(cwd, ".steer", "knowledge");
  const entries: KnowledgeEntry[] = [];

  for (const mod of modules) {
    const filePath = join(knowledgeDir, `${mod}.md`);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf-8").trim();
      if (content) {
        entries.push({ module: mod, content });
      }
    }
  }

  return entries;
}

/**
 * Load global knowledge (_global.md) that applies to all tasks.
 */
export function loadGlobalKnowledge(cwd: string): string {
  const globalPath = join(cwd, ".steer", "knowledge", "_global.md");
  if (!existsSync(globalPath)) return "";
  return readFileSync(globalPath, "utf-8").trim();
}

/**
 * Load RULES.md (team constraints, always loaded).
 */
export function loadRules(cwd: string): string {
  const rulesPath = join(cwd, ".steer", "RULES.md");
  if (!existsSync(rulesPath)) return "";
  return readFileSync(rulesPath, "utf-8").trim();
}
