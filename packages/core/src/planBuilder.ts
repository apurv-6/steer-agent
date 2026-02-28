import { PlanStep, ImpactPreview, CodebaseMap } from "./types.js";
import { TaskState } from "./state.js";

export interface PlanContext {
  task: TaskState;
  codemap?: CodebaseMap;
  goal: string;
  files: string[];
}

/**
 * Build an execution plan from task context and codebase map.
 * Decomposes the task into steps using codemap (files to modify, tests to update).
 */
export function buildPlan(ctx: PlanContext): { steps: PlanStep[]; impact: ImpactPreview } {
  const steps: PlanStep[] = [];
  let stepId = 1;

  // Step for each file to modify
  for (const file of ctx.files) {
    const fileInfo = ctx.codemap?.files[file];
    const dep = ctx.codemap?.dependencies[file];

    steps.push({
      id: stepId++,
      description: `Modify ${file}`,
      files: [file],
      action: "modify",
      risk: determineFileRisk(file, ctx.codemap),
      reason: fileInfo ? `${fileInfo.role}, ${fileInfo.loc ?? "?"} LOC` : undefined,
    });

    // Add test step if test file exists
    if (dep?.testFile) {
      steps.push({
        id: stepId++,
        description: `Update tests: ${dep.testFile}`,
        files: [dep.testFile],
        action: "test",
        risk: "low",
      });
    }
  }

  const impact = computeImpact(ctx.files, ctx.codemap);
  return { steps, impact };
}

/**
 * Compute impact preview for a set of files.
 */
export function computeImpact(
  files: string[],
  codemap?: CodebaseMap,
): ImpactPreview {
  const downstreamDeps = new Set<string>();
  const testsToRun = new Set<string>();

  if (codemap) {
    for (const file of files) {
      const dep = codemap.dependencies[file];
      if (dep) {
        for (const consumer of dep.importedBy) {
          downstreamDeps.add(consumer);
        }
        if (dep.testFile) testsToRun.add(dep.testFile);
      }

      // Check coupling
      const coupled = codemap.coupling[file];
      if (coupled) {
        for (const [related, freq] of Object.entries(coupled)) {
          if (freq > 0.5) downstreamDeps.add(related);
        }
      }
    }
  }

  const riskLevel = determineOverallRisk(files, codemap);

  return {
    filesModified: files,
    downstreamDeps: [...downstreamDeps],
    testsToRun: [...testsToRun],
    riskLevel,
    summary: `${files.length} file(s) modified, ${downstreamDeps.size} downstream dep(s), ${testsToRun.size} test(s) to run. Risk: ${riskLevel}.`,
  };
}

function determineFileRisk(file: string, codemap?: CodebaseMap): "low" | "medium" | "high" {
  if (!codemap) return "medium";

  // Critical module check
  for (const mod of Object.values(codemap.modules)) {
    if (mod.critical && mod.files.includes(file)) return "high";
  }

  // High LOC = higher risk
  const info = codemap.files[file];
  if (info?.loc && info.loc > 300) return "high";

  // Many importers = higher risk
  const dep = codemap.dependencies[file];
  if (dep?.importedBy && dep.importedBy.length > 5) return "high";

  return "low";
}

function determineOverallRisk(files: string[], codemap?: CodebaseMap): "low" | "medium" | "high" {
  if (!codemap) return "medium";

  const risks = files.map((f) => determineFileRisk(f, codemap));
  if (risks.includes("high")) return "high";
  if (risks.includes("medium") || files.length > 5) return "medium";
  return "low";
}
