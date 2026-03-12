import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import { extractLearnings, persistLearnings, updateKnowledgeFile, transitionStep, completeTask, steerDirExists, logToolCall, emitAndSync } from "@steer-agent-tool/core";

export const LearnSchema = {
  taskId: z.string().describe("Task ID to extract learnings from"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleLearn(args: { taskId: string; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();

    if (!steerDirExists(cwd)) {
      return {
        content: [{ type: "text" as const, text: "SteerAgent is not initialized in this project.\n\nRun:\n  steer-agent init\n\nOr with npx:\n  npx @coinswitch/steer-agent init" }],
      };
    }

    const statePath = join(cwd, ".steer", "state", "current-task.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8"));

    try { logToolCall("steer.learn", { taskId: args.taskId }, cwd); } catch {}

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

    // Transition through learning step then to done
    state.learningNotes = learnings;
    const afterLearning = transitionStep(state, "learning");

    // Write history entry before transitioning to done
    const historyEntry = completeTask(afterLearning, cwd);

    // Transition to done
    const final = transitionStep(afterLearning, "done");
    final.resumable = false;
    const durationMs = final.startedAt ? Date.now() - new Date(final.startedAt).getTime() : 0;
    emitAndSync(cwd, { taskId: args.taskId, type: "learning_extracted", payload: { learnings, modules: [...byModule.keys()] } }, final);
    emitAndSync(cwd, { taskId: args.taskId, type: "task_completed", payload: { fpcr: historyEntry.fpcr, durationMs, round: historyEntry.round } }, final);

    try { logToolCall("steer.learn.done", { taskId: args.taskId, learnings: learnings.length, fpcr: historyEntry.fpcr, durationMs: historyEntry.durationMs }, cwd); } catch {}

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          taskId: args.taskId,
          status: "done",
          learnings: learnings.length,
          modules: [...byModule.keys()],
          entries: learnings.map((l: any) => ({ category: l.category, summary: l.summary, module: l.module })),
          fpcr: historyEntry.fpcr,
          round: historyEntry.round,
          durationMs: historyEntry.durationMs,
        }, null, 2),
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}
