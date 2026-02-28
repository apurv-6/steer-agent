import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { Mode, KnowledgeEntry, SimilarTask, CodebaseMap } from "./types.js";
import { loadRules, loadGlobalKnowledge } from "./knowledgeLoader.js";

export interface AssemblyContext {
  cwd: string;
  mode: Mode;
  /** Developer-provided answers keyed by field name */
  answers: Record<string, string>;
  /** Knowledge entries for affected modules */
  knowledge: KnowledgeEntry[];
  /** Similar past tasks */
  similarTasks: SimilarTask[];
  /** Codebase map (or subset) */
  codemap?: CodebaseMap;
  /** Git context (blame, recent commits, etc.) */
  gitContext?: string;
  /** Affected files */
  files?: string[];
}

/**
 * Assemble a full prompt from template + all context sources.
 * Follows the prompt hierarchy:
 *   RULES → KNOWLEDGE → CODEBASE → HISTORY → TEMPLATE → CONTEXT → TASK → CONSTRAINTS → OUTPUT → VERIFICATION
 */
export function assemblePrompt(ctx: AssemblyContext): string {
  const template = loadTemplate(ctx.mode, ctx.cwd);
  const rules = loadRules(ctx.cwd);
  const globalKnowledge = loadGlobalKnowledge(ctx.cwd);

  // Build replacement map
  const replacements: Record<string, string> = {
    ...ctx.answers,
    rules_from_RULES_md: rules || "No team rules defined.",
    "rules_from_RULES.md": rules || "No team rules defined.",
    knowledge_entries: formatKnowledge(ctx.knowledge, globalKnowledge),
    codebase_map_excerpt: formatCodemapExcerpt(ctx.codemap, ctx.files),
    dependency_chain: formatDependencies(ctx.codemap, ctx.files),
    related_tests_from_codemap: formatTests(ctx.codemap, ctx.files),
    git_context: ctx.gitContext || "No git context available.",
    similar_tasks: formatSimilarTasks(ctx.similarTasks),
  };

  // Replace {placeholder} tokens in the template body
  let assembled = getTemplateBody(template);
  for (const [key, value] of Object.entries(replacements)) {
    assembled = assembled.replace(new RegExp(`\\{${escapeRegex(key)}\\}`, "g"), value);
  }

  // Prepend rules + knowledge (always first per hierarchy)
  const sections: string[] = [];

  if (rules) {
    sections.push(`## Team Rules\n${rules}`);
  }

  const knowledgeBlock = formatKnowledge(ctx.knowledge, globalKnowledge);
  if (knowledgeBlock) {
    sections.push(`## Knowledge\n${knowledgeBlock}`);
  }

  if (ctx.similarTasks.length > 0) {
    sections.push(`## Similar Past Tasks\n${formatSimilarTasks(ctx.similarTasks)}`);
  }

  sections.push(assembled);

  return sections.join("\n\n");
}

/**
 * Load a mode template from .steer/templates/ (project) or templates/ (defaults).
 */
export function loadTemplate(mode: Mode, cwd: string): string {
  // Project-specific template takes priority
  const projectPath = join(cwd, ".steer", "templates", `${mode}.md`);
  if (existsSync(projectPath)) {
    return readFileSync(projectPath, "utf-8");
  }

  // Fall back to default templates (shipped with package)
  const defaultPath = join(cwd, "templates", `${mode}.md`);
  if (existsSync(defaultPath)) {
    return readFileSync(defaultPath, "utf-8");
  }

  // Generic fallback
  return `GOAL: {goal}\nCONTEXT: {context}\nLIMITS: {limits}\nOUTPUT FORMAT: {outputFormat}\nREVIEW: {acceptance_criteria}`;
}

/**
 * Parse YAML frontmatter from a template.
 */
export function parseFrontmatter(template: string): Record<string, any> {
  const match = template.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: Record<string, any> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) {
      const [, key, value] = kv;
      // Handle arrays: [a, b, c]
      if (value.startsWith("[") && value.endsWith("]")) {
        result[key] = value.slice(1, -1).split(",").map((s) => s.trim());
      } else if (value === "true") {
        result[key] = true;
      } else if (value === "false") {
        result[key] = false;
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Get the template body (everything after frontmatter).
 */
function getTemplateBody(template: string): string {
  const match = template.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : template;
}

function formatKnowledge(entries: KnowledgeEntry[], globalKnowledge: string): string {
  const parts: string[] = [];
  if (globalKnowledge) parts.push(globalKnowledge);
  for (const entry of entries) {
    parts.push(`### ${entry.module}\n${entry.content}`);
  }
  return parts.join("\n\n") || "";
}

function formatCodemapExcerpt(codemap?: CodebaseMap, files?: string[]): string {
  if (!codemap || !files?.length) return "No codebase map available.";

  const relevant: string[] = [];
  for (const file of files) {
    const info = codemap.files[file];
    if (info) {
      relevant.push(`- ${file} (${info.role}, ${info.loc ?? "?"} LOC)`);
    }
  }
  return relevant.length > 0 ? relevant.join("\n") : "Files not found in codebase map.";
}

function formatDependencies(codemap?: CodebaseMap, files?: string[]): string {
  if (!codemap || !files?.length) return "No dependency info.";

  const deps: string[] = [];
  for (const file of files) {
    const dep = codemap.dependencies[file];
    if (dep) {
      if (dep.imports.length) deps.push(`${file} imports: ${dep.imports.join(", ")}`);
      if (dep.importedBy.length) deps.push(`${file} imported by: ${dep.importedBy.join(", ")}`);
    }
  }
  return deps.length > 0 ? deps.join("\n") : "No dependencies found.";
}

function formatTests(codemap?: CodebaseMap, files?: string[]): string {
  if (!codemap || !files?.length) return "No test mapping.";

  const tests: string[] = [];
  for (const file of files) {
    const dep = codemap.dependencies[file];
    if (dep?.testFile) tests.push(`${file} → ${dep.testFile}`);
  }
  return tests.length > 0 ? tests.join("\n") : "No matched test files.";
}

function formatSimilarTasks(tasks: SimilarTask[]): string {
  if (tasks.length === 0) return "";
  return tasks
    .map((t) => `- [${t.mode}] ${t.goal} (similarity: ${t.score.toFixed(1)})${t.resolution ? ` → ${t.resolution}` : ""}`)
    .join("\n");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
