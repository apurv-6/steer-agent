import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { extractLearnings, persistLearnings, updateKnowledgeFile, transitionStep } from "@steer-agent-tool/core";

export const LearnSchema = {
  taskId: z.string().describe("Task ID to extract learnings from"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleLearn(args: { taskId: string; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();

    const statePath = join(cwd, ".steer", "state", "current-task.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8"));

    const learnings = extractLearnings(state);

    // Persist to learnings.jsonl
    persistLearnings(learnings, cwd);

    // Update knowledge files (grouped by module)
    const byModule = new Map<string, typeof learnings>();
    for (const l of learnings) {
      const arr = byModule.get(l.module) || [];
      arr.push(l);
      byModule.set(l.module, arr);
    }
    for (const [module, entries] of byModule) {
      updateKnowledgeFile(module, entries, cwd);
    }

    // Transition to learning step
    state.learningNotes = learnings;
    const updated = transitionStep(state, "learning");
    writeFileSync(statePath, JSON.stringify(updated, null, 2));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          taskId: args.taskId,
          learnings: learnings.length,
          modules: [...byModule.keys()],
          entries: learnings.map((l: any) => ({ category: l.category, summary: l.summary, module: l.module })),
        }, null, 2),
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}
