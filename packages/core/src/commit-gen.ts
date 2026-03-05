import { TaskState } from "./state.js";
import { Mode } from "./types.js";
import path from "path";

const MODE_TO_TYPE: Record<Mode, string> = {
  bugfix: "fix",
  debug: "fix",
  feature: "feat",
  refactor: "refactor",
  design: "docs",
  code: "feat",
  chat: "chore",
  review: "chore",
  plan: "chore",
};

/**
 * Generate a Conventional Commits message from task state.
 * Format: type(scope): description
 */
export function generateCommitMessage(task: TaskState): string {
  const type = MODE_TO_TYPE[task.mode] || "chore";
  const scope = deriveScope(task.files);
  const description = deriveDescription(task);

  const header = scope ? `${type}(${scope}): ${description}` : `${type}: ${description}`;

  // Build body
  const body: string[] = [];

  if (task.files.length > 0) {
    body.push(`Files: ${task.files.join(", ")}`);
  }

  if (task.planSteps.length > 0) {
    body.push("");
    body.push("Changes:");
    for (const step of task.planSteps) {
      body.push(`- ${step.description}`);
    }
  }

  if (task.learningNotes.length > 0) {
    body.push("");
    body.push("Learnings:");
    for (const note of task.learningNotes) {
      body.push(`- [${note.category}] ${note.summary}`);
    }
  }

  return body.length > 0 ? `${header}\n\n${body.join("\n")}` : header;
}

function deriveScope(files: string[]): string {
  if (files.length === 0) return "";

  // Use most common directory as scope
  const dirs = files.map((f) => {
    const parts = f.split(path.sep);
    // Use second-level dir if available (e.g., packages/core → core)
    if (parts.length > 2 && parts[0] === "packages") return parts[1];
    if (parts.length > 1) return parts[0];
    return path.basename(f, path.extname(f));
  });

  const counts = new Map<string, number>();
  for (const d of dirs) counts.set(d, (counts.get(d) ?? 0) + 1);

  let maxDir = "";
  let maxCount = 0;
  for (const [dir, count] of counts) {
    if (count > maxCount) { maxDir = dir; maxCount = count; }
  }

  return maxDir;
}

function deriveDescription(task: TaskState): string {
  if (task.goal) {
    // Trim to first sentence, max 72 chars
    const first = task.goal.split(/[.!?\n]/)[0].trim();
    return first.length > 68 ? first.slice(0, 68) + "..." : first.toLowerCase();
  }

  // Fallback: derive from mode + file count
  return `${task.mode} changes across ${task.files.length} file(s)`;
}
