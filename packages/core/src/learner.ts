import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { LearningEntry, LearningCategory } from "./types.js";
import { TaskState } from "./state.js";

/**
 * Extract learnings from a completed task using deterministic rules.
 * - Root cause identified → pattern
 * - Multi-round (round > 1) → gotcha
 * - Scope expanded beyond plan → dependency
 * - Abandoned approach → failed_approach
 */
export function extractLearnings(task: TaskState): LearningEntry[] {
  const learnings: LearningEntry[] = [];
  const now = new Date().toISOString();

  // Derive primary module from files
  const module = deriveModule(task.files);

  // Rule: multi-round indicates a gotcha
  if (task.round > 1) {
    learnings.push({
      id: `${task.taskId}-gotcha-${learnings.length}`,
      taskId: task.taskId,
      module,
      category: "gotcha",
      summary: `Task required ${task.round} rounds to complete in ${task.mode} mode.`,
      detail: `Files: ${task.files.join(", ")}`,
      createdAt: now,
    });
  }

  // Rule: reflection failed means there's a pattern to learn
  if (task.reflectionPassed === false) {
    learnings.push({
      id: `${task.taskId}-pattern-${learnings.length}`,
      taskId: task.taskId,
      module,
      category: "pattern",
      summary: `Reflection identified issues in ${task.mode} task on ${module}.`,
      createdAt: now,
    });
  }

  // Rule: verification failed means there's a convention to document
  if (task.verificationOutcome && !task.verificationOutcome.passed) {
    const failedChecks = task.verificationOutcome.checks
      .filter((c) => !c.passed)
      .map((c) => c.name);
    learnings.push({
      id: `${task.taskId}-convention-${learnings.length}`,
      taskId: task.taskId,
      module,
      category: "convention",
      summary: `Verification failures: ${failedChecks.join(", ")}`,
      detail: task.verificationOutcome.summary,
      createdAt: now,
    });
  }

  // Rule: scope expansion (more files touched than planned)
  if (task.planSteps.length > 0) {
    const plannedFiles = new Set(task.planSteps.flatMap((s) => s.files));
    const extraFiles = task.files.filter((f) => !plannedFiles.has(f));
    if (extraFiles.length > 0) {
      learnings.push({
        id: `${task.taskId}-dependency-${learnings.length}`,
        taskId: task.taskId,
        module,
        category: "dependency",
        summary: `Scope expanded: ${extraFiles.length} unplanned file(s) modified.`,
        detail: `Extra files: ${extraFiles.join(", ")}`,
        createdAt: now,
      });
    }
  }

  // Include any explicit learning notes from the task
  learnings.push(...task.learningNotes);

  return learnings;
}

/**
 * Persist learning entries to .steer/state/learnings.jsonl.
 */
export function persistLearnings(entries: LearningEntry[], cwd: string): void {
  if (entries.length === 0) return;

  const stateDir = join(cwd, ".steer", "state");
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });

  const path = join(stateDir, "learnings.jsonl");
  const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  appendFileSync(path, lines, "utf-8");
}

/**
 * Update the knowledge file for a module by appending new learnings.
 * Writes to .steer/knowledge/{module}.md (append-only).
 */
export function updateKnowledgeFile(
  module: string,
  entries: LearningEntry[],
  cwd: string,
): void {
  if (entries.length === 0) return;

  const knowledgeDir = join(cwd, ".steer", "knowledge");
  if (!existsSync(knowledgeDir)) mkdirSync(knowledgeDir, { recursive: true });

  const filePath = join(knowledgeDir, `${sanitizeFilename(module)}.md`);

  let existing = "";
  if (existsSync(filePath)) {
    existing = readFileSync(filePath, "utf-8");
  } else {
    existing = `# ${module}\n\nKnowledge accumulated from AI-assisted tasks.\n\n`;
  }

  const newEntries = entries
    .map((e) => {
      const date = e.createdAt.split("T")[0];
      return `### [${e.category}] ${e.summary} (${date})\n${e.detail || ""}\n`;
    })
    .join("\n");

  writeFileSync(filePath, existing + "\n" + newEntries, "utf-8");
}

function deriveModule(files: string[]): string {
  if (files.length === 0) return "_global";
  // Use the most common top-level directory
  const dirs = files.map((f) => {
    const parts = f.replace(/^\.?\//, "").split("/");
    return parts.length > 1 ? parts[0] : "_root";
  });
  const counts = new Map<string, number>();
  for (const d of dirs) counts.set(d, (counts.get(d) ?? 0) + 1);
  let maxDir = "_global";
  let maxCount = 0;
  for (const [dir, count] of counts) {
    if (count > maxCount) {
      maxDir = dir;
      maxCount = count;
    }
  }
  return maxDir;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}
