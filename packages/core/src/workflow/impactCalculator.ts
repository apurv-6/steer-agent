import type { CodebaseMap, ImpactPreview, SteerConfig } from "./types.js";

/**
 * Find all files that import/depend on the given file.
 */
export function findDownstream(
  file: string,
  map: CodebaseMap,
): string[] {
  const dep = map.dependencies[file];
  if (!dep) return [];
  return [...dep.calledBy];
}

/**
 * Find test files that cover the given source files (direct + downstream).
 */
export function findRelatedTests(
  files: string[],
  map: CodebaseMap,
): string[] {
  const tests = new Set<string>();

  for (const file of files) {
    const dep = map.dependencies[file];
    if (!dep) continue;

    // Direct test
    if (dep.testedBy) {
      tests.add(dep.testedBy);
    }

    // Check modules for test mappings
    for (const mod of Object.values(map.modules)) {
      if (mod.testFiles) {
        for (const [testFile, info] of Object.entries(mod.testFiles)) {
          const basename = file.split("/").pop() ?? "";
          if (info.covers === basename || file.endsWith(info.covers)) {
            tests.add(testFile);
          }
        }
      }
    }
  }

  return [...tests];
}

/**
 * Compute risk level based on change characteristics.
 */
export function computeRisk(
  filesModified: string[],
  downstream: string[],
  criticalModules: string[],
  changeCoupledNotInScope?: string[],
): "LOW" | "MEDIUM" | "HIGH" {
  const hitsCritical = filesModified.some((f) =>
    criticalModules.some((cm) => f.startsWith(cm) || f.includes(cm)),
  );
  const hasDownstream = downstream.length > 0;
  const hasCouplingOutOfScope = (changeCoupledNotInScope?.length ?? 0) > 0;

  if (hitsCritical && hasDownstream) return "HIGH";
  if (hitsCritical || (hasDownstream && downstream.length > 2)) return "MEDIUM";
  if (hasCouplingOutOfScope) return "MEDIUM";
  return "LOW";
}

/**
 * Calculate the full change impact preview for a set of planned file modifications.
 */
export function calculateImpact(
  plannedFiles: string[],
  map: CodebaseMap,
  config?: SteerConfig,
): ImpactPreview {
  const criticalModules = config?.defaults?.criticalModules ?? [];

  // Find all downstream dependencies
  const downstreamSet = new Set<string>();
  for (const file of plannedFiles) {
    for (const ds of findDownstream(file, map)) {
      if (!plannedFiles.includes(ds)) {
        downstreamSet.add(ds);
      }
    }
  }
  const downstream = [...downstreamSet];

  // Find all related tests (for modified + downstream files)
  const allAffected = [...plannedFiles, ...downstream];
  const testsToRun = findRelatedTests(allAffected, map);

  // Check change coupling — files that usually change together but aren't in scope
  const changeCoupled: Array<{ file: string; coupling: number; inScope: boolean }> = [];
  if (map.changeCoupling) {
    for (const file of plannedFiles) {
      const coupled = map.changeCoupling[file];
      if (!coupled) continue;
      for (const [coupledFile, ratio] of Object.entries(coupled)) {
        if (ratio >= 0.5) { // Only significant coupling
          changeCoupled.push({
            file: coupledFile,
            coupling: ratio,
            inScope: plannedFiles.includes(coupledFile),
          });
        }
      }
    }
  }

  const coupledNotInScope = changeCoupled
    .filter((c) => !c.inScope)
    .map((c) => c.file);

  // Compute risk
  const riskLevel = computeRisk(plannedFiles, downstream, criticalModules, coupledNotInScope);

  return {
    filesModified: plannedFiles,
    downstream,
    testsToRun,
    riskLevel,
    changeCoupling: changeCoupled.length > 0 ? changeCoupled : undefined,
  };
}
