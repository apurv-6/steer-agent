import { execSync } from "child_process";

export interface AttemptRecord {
  attempt: number;
  branch: string;
  startedAt: string;
  endedAt?: string;
  outcome: "pending" | "passed" | "failed";
  failReason?: string;
}

/**
 * Get the current git branch name.
 */
export function getCurrentBranch(cwd: string): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { cwd, encoding: "utf-8" }).trim();
}

/**
 * Check if the working tree is clean (no uncommitted changes).
 */
export function isWorkingTreeClean(cwd: string): boolean {
  const status = execSync("git status --porcelain", { cwd, encoding: "utf-8" }).trim();
  return status.length === 0;
}

/**
 * Create and checkout an attempt branch: steer/{taskId}-attempt-{n}
 */
export function createAttemptBranch(cwd: string, taskId: string, attempt: number): string {
  const branchName = `steer/${taskId}-attempt-${attempt}`;
  execSync(`git checkout -b ${branchName}`, { cwd, encoding: "utf-8" });
  return branchName;
}

/**
 * Delete an attempt branch (force). Checks out originBranch first if currently on the target.
 */
export function deleteAttemptBranch(cwd: string, branchName: string, originBranch: string): void {
  const current = getCurrentBranch(cwd);
  if (current === branchName) {
    execSync(`git checkout ${originBranch}`, { cwd, encoding: "utf-8" });
  }
  execSync(`git branch -D ${branchName}`, { cwd, encoding: "utf-8" });
}

/**
 * Merge an attempt branch into originBranch using the specified strategy.
 */
export function mergeAttemptBranch(
  cwd: string,
  branchName: string,
  originBranch: string,
  strategy: "squash" | "ff" | "rebase" = "squash",
): void {
  execSync(`git checkout ${originBranch}`, { cwd, encoding: "utf-8" });

  switch (strategy) {
    case "squash":
      execSync(`git merge --squash ${branchName}`, { cwd, encoding: "utf-8" });
      execSync(`git commit -m "steer: merge ${branchName}"`, { cwd, encoding: "utf-8" });
      break;
    case "ff":
      execSync(`git merge --ff-only ${branchName}`, { cwd, encoding: "utf-8" });
      break;
    case "rebase":
      execSync(`git rebase ${branchName}`, { cwd, encoding: "utf-8" });
      break;
  }

  // Clean up the attempt branch after merge
  execSync(`git branch -D ${branchName}`, { cwd, encoding: "utf-8" });
}

export interface BuildCheckResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; output: string }>;
}

/**
 * Run build checks (build, lint, test) in the given directory.
 * Each check is optional — only runs if the corresponding npm script exists.
 */
export function runBuildChecks(cwd: string, scripts: string[] = ["build", "lint", "test"]): BuildCheckResult {
  const checks: BuildCheckResult["checks"] = [];

  for (const script of scripts) {
    try {
      const output = execSync(`npm run ${script} --if-present 2>&1`, {
        cwd,
        encoding: "utf-8",
        timeout: 120_000,
      });
      checks.push({ name: script, passed: true, output: output.slice(-500) });
    } catch (err: unknown) {
      const output = err instanceof Error ? (err as any).stdout || err.message : String(err);
      checks.push({ name: script, passed: false, output: String(output).slice(-500) });
    }
  }

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}
