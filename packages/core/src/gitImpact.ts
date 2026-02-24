import type { GitImpact } from "./types.js";

/**
 * Parse `git diff --stat` and `git diff --name-only` output into a GitImpact.
 * If criticalPaths provided, flags any changed files matching those patterns.
 */
export function parseGitImpact(
  diffStat: string,
  diffNameOnly: string,
  criticalPaths: string[] = [],
): GitImpact {
  const changedFiles = diffNameOnly
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Parse summary line from --stat: " 5 files changed, 120 insertions(+), 30 deletions(-)"
  let filesChanged = changedFiles.length;
  let insertions = 0;
  let deletions = 0;

  const summaryMatch = diffStat.match(
    /(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/,
  );
  if (summaryMatch) {
    filesChanged = parseInt(summaryMatch[1], 10) || filesChanged;
    insertions = parseInt(summaryMatch[2], 10) || 0;
    deletions = parseInt(summaryMatch[3], 10) || 0;
  }

  // Match changed files against critical paths
  const criticalFilesHit = changedFiles.filter((file) =>
    criticalPaths.some((pattern) => {
      // Support simple glob: "src/auth/*" matches "src/auth/login.ts"
      if (pattern.endsWith("/*")) {
        return file.startsWith(pattern.slice(0, -1));
      }
      // Exact or prefix match
      return file === pattern || file.startsWith(pattern + "/");
    }),
  );

  // Determine impact level
  const totalChanges = insertions + deletions;
  let impactLevel: GitImpact["impactLevel"] = "low";
  if (criticalFilesHit.length > 0 || totalChanges > 500 || filesChanged > 20) {
    impactLevel = "high";
  } else if (totalChanges > 100 || filesChanged > 5) {
    impactLevel = "medium";
  }

  return {
    filesChanged,
    insertions,
    deletions,
    changedFiles,
    criticalFilesHit,
    impactLevel,
  };
}
