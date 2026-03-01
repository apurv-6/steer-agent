import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Fetch GitHub data via `gh` CLI.
 * Params: action (prs|ci|merges), repo (optional)
 */
export async function importFrom(
  params: Record<string, string>,
  timeoutMs: number = 5000,
): Promise<string> {
  const action = params.action || "prs";
  const cwd = params.cwd || process.cwd();

  switch (action) {
    case "prs":
      return fetchOpenPRs(cwd, timeoutMs);
    case "ci":
      return fetchCIStatus(cwd, timeoutMs);
    case "merges":
      return fetchRecentMerges(cwd, timeoutMs);
    default:
      return `Unknown GitHub action: ${action}`;
  }
}

async function fetchOpenPRs(cwd: string, timeoutMs: number): Promise<string> {
  try {
    const { stdout } = await execAsync(
      "gh pr list --state open --limit 10 --json number,title,author,labels,updatedAt",
      { cwd, timeout: timeoutMs },
    );
    return stdout.trim() || "No open PRs";
  } catch {
    return "GitHub CLI not available or not authenticated";
  }
}

async function fetchCIStatus(cwd: string, timeoutMs: number): Promise<string> {
  try {
    const { stdout } = await execAsync(
      "gh run list --limit 5 --json status,conclusion,name,updatedAt",
      { cwd, timeout: timeoutMs },
    );
    return stdout.trim() || "No CI runs";
  } catch {
    return "GitHub CLI not available or not authenticated";
  }
}

async function fetchRecentMerges(cwd: string, timeoutMs: number): Promise<string> {
  try {
    const { stdout } = await execAsync(
      "gh pr list --state merged --limit 5 --json number,title,mergedAt",
      { cwd, timeout: timeoutMs },
    );
    return stdout.trim() || "No recent merges";
  } catch {
    return "GitHub CLI not available or not authenticated";
  }
}
