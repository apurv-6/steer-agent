import fs from "fs-extra";
import path from "path";
import yaml from "yaml";
import { Mode, CodebaseMap } from "./types.js";
import { createNewTask } from "./state.js";
import { extractFileRefs } from "./extractFileRefs.js";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export interface StartOptions {
  cwd: string;
  mode: Mode;
  taskId: string;
  initialMessage?: string;
}

export async function startTask(options: StartOptions) {
  const { cwd, mode, taskId, initialMessage = "" } = options;
  const steerDir = path.join(cwd, ".steer");

  // 1. Load resources
  const rulesPath = path.join(steerDir, "RULES.md");
  let rules = "";
  try {
    rules = await fs.readFile(rulesPath, "utf-8");
  } catch (e) {
    // If RULES.md missing, warn or skip
    console.warn("RULES.md not found, proceeding without rules.");
  }

  const mapPath = path.join(steerDir, "codebase-map.json");
  let codemap: CodebaseMap | null = null;
  try {
    codemap = await fs.readJSON(mapPath);
  } catch (e) {
    throw new Error("Codebase map not found at .steer/codebase-map.json. Run 'steer.init' first.");
  }

  // 2. Load Template
  const templatePath = path.join(steerDir, "templates", `${mode}.md`);
  if (!await fs.pathExists(templatePath)) {
    throw new Error(`Template for mode '${mode}' not found at ${templatePath}`);
  }
  const templateContent = await fs.readFile(templatePath, "utf-8");

  // Parse Frontmatter
  // Note: splitting by "---" is simplistic but works for standard frontmatter
  const parts = templateContent.split("---");
  let frontmatter: any = {};
  let templateBody = templateContent;

  if (parts.length >= 3) {
      try {
          frontmatter = yaml.parse(parts[1]);
          templateBody = parts.slice(2).join("---");
      } catch (e) {
          console.warn("Failed to parse frontmatter:", e);
      }
  }

  // 3. Initialize State
  const state = createNewTask(taskId, mode);

  // 4. Process Initial Message (Detect @files)
  const referencedFiles = extractFileRefs(initialMessage);

  // Resolve dependencies for referenced files (using Codemap)
  const resolvedFiles = new Set<string>();
  const allFiles = Object.keys(codemap?.files || {});

  for (const ref of referencedFiles) {
    // Try to find matching file in codemap (suffix match usually)
    const match = allFiles.find(f => f.endsWith(ref));
    if (match) {
      resolvedFiles.add(match);
      // Add direct imports (1 level deep for now)
      const deps = codemap?.dependencies[match]?.imports || [];
      for (const dep of deps) {
          const depMatch = allFiles.find(f => f.endsWith(dep));
          if (depMatch) resolvedFiles.add(depMatch);
      }
    }
  }

  const resolvedFileList = Array.from(resolvedFiles);

  // 5. Build Initial Context
  const gitContext = await getGitContext(cwd, resolvedFileList);

  const context = {
    rules,
    codemapSummary: codemap ? `Root: ${codemap.root}, Modules: ${Object.keys(codemap.modules).length}, Files: ${Object.keys(codemap.files).length}` : "No map",
    referencedFiles: resolvedFileList,
    gitContext,
    template: {
      frontmatter,
      body: templateBody
    },
    initialMessage
  };

  state.context = context;
  state.files = resolvedFileList;
  state.sourcesUsed.push("codemap", "files");
  if (gitContext) state.sourcesUsed.push("git");

  // 6. Save State
  const statePath = path.join(steerDir, "state", "current-task.json");
  await fs.ensureDir(path.dirname(statePath));
  await fs.writeJSON(statePath, state, { spaces: 2 });

  return {
    state,
    message: `Started task ${taskId} in ${mode} mode.`,
    template: frontmatter,
    initialQuestions: generateInitialQuestions(frontmatter),
    context
  };
}

async function getGitContext(cwd: string, files: string[]): Promise<string> {
  if (files.length === 0) return "";

  let output = "";
  try {
      // Get recent changes for specific files
      for (const file of files.slice(0, 5)) {
        const { stdout } = await execAsync(`git log --oneline -n 3 -- ${file}`, { cwd }).catch(() => ({ stdout: "" }));
        if (stdout.trim()) output += `Recent changes for ${file}:\n${stdout}\n`;
      }
  } catch (e) {
      console.warn("Failed to fetch git context:", e);
  }
  return output;
}

function generateInitialQuestions(frontmatter: any) {
  const required = frontmatter.required_fields || [];
  return required.map((field: string) => ({
    id: field,
    question: `Please provide: ${field}`,
    type: "text"
  }));
}
