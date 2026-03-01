import { TaskState } from "./state.js";

/**
 * Generate a PR description from task state.
 * Format: What / Why / How / Impact / Testing
 */
export function generatePRDescription(task: TaskState): string {
  const sections: string[] = [];

  // What
  sections.push("## What");
  sections.push(task.goal || `${task.mode} task (${task.taskId})`);

  // Why
  sections.push("\n## Why");
  if (task.mode === "bugfix" || task.mode === "debug") {
    sections.push("Fix reported issue to improve reliability.");
  } else if (task.mode === "feature") {
    sections.push("Add new functionality as requested.");
  } else if (task.mode === "refactor") {
    sections.push("Improve code quality and maintainability.");
  } else {
    sections.push(`${task.mode} task to improve the codebase.`);
  }

  // How
  sections.push("\n## How");
  if (task.planSteps.length > 0) {
    for (const step of task.planSteps) {
      const risk = step.risk === "high" ? " :warning:" : step.risk === "medium" ? " :large_orange_diamond:" : "";
      sections.push(`- ${step.description} (${step.action}: ${step.files.join(", ")})${risk}`);
    }
  } else {
    sections.push("Modified files:");
    for (const file of task.files) {
      sections.push(`- \`${file}\``);
    }
  }

  // Impact
  sections.push("\n## Impact");
  sections.push(`- **Files changed:** ${task.files.length}`);
  sections.push(`- **Rounds:** ${task.round}`);
  if (task.verificationOutcome) {
    const v = task.verificationOutcome;
    sections.push(`- **Verification:** ${v.passed ? "Passed" : "Failed"} (${v.summary})`);
  }
  if (task.overrideUsed) {
    sections.push("- **Override used:** Yes");
  }

  // Testing
  sections.push("\n## Testing");
  if (task.verificationOutcome?.checks) {
    for (const check of task.verificationOutcome.checks) {
      sections.push(`- [${check.passed ? "x" : " "}] ${check.name}${check.detail ? `: ${check.detail}` : ""}`);
    }
  } else {
    sections.push("- [ ] Manual testing required");
  }

  // Learnings
  if (task.learningNotes.length > 0) {
    sections.push("\n## Learnings");
    for (const note of task.learningNotes) {
      sections.push(`- **[${note.category}]** ${note.summary}`);
    }
  }

  return sections.join("\n");
}
