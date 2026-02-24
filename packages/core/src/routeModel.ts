import type { RouteInput, RouteResult } from "./types.js";

// Rough cost per 1K tokens (input+output blended) in USD
const COST_PER_1K: Record<string, number> = {
  small: 0.0003,  // e.g. haiku / gpt-4o-mini
  mid: 0.003,     // e.g. sonnet / gpt-4o
  high: 0.015,    // e.g. opus / o1
};

// Tier-to-model mapping
const TIER_MODELS: Record<string, { modelName: string; provider: string }> = {
  small: { modelName: "claude-3-5-haiku-latest", provider: "anthropic" },
  mid: { modelName: "claude-sonnet-4-20250514", provider: "anthropic" },
  high: { modelName: "claude-opus-4-20250514", provider: "anthropic" },
};

export function routeModel(input: RouteInput): RouteResult {
  const explanations: string[] = [];
  let tier: RouteResult["tier"] = "small";

  const git = input.gitImpact;

  // Rule 1: Critical files → always high
  if (git && git.criticalFilesHit.length > 0) {
    tier = "high";
    explanations.push(`Critical files touched: ${git.criticalFilesHit.join(", ")}`);
  }

  // Rule 2: High git impact (large diff or many files) → at least mid
  if (git && git.impactLevel === "high" && tier === "small") {
    tier = "mid";
    explanations.push(`High git impact: ${git.filesChanged} files, +${git.insertions}/-${git.deletions} lines`);
  }

  // Rule 3: Design/plan mode with good prompt → high (needs reasoning)
  if ((input.mode === "design" || input.mode === "plan") && input.score >= 7) {
    if (tier !== "high") {
      tier = "high";
      explanations.push(`${input.mode} mode with strong prompt requires deep reasoning`);
    }
  }

  // Rule 4: Review mode → at least mid (needs careful analysis)
  if (input.mode === "review" && tier === "small") {
    tier = "mid";
    explanations.push("Code review requires careful multi-file analysis");
  }

  // Rule 5: Bugfix/debug with good prompt → mid
  if ((input.mode === "bugfix" || input.mode === "debug") && input.score >= 7 && tier === "small") {
    tier = "mid";
    explanations.push(`${input.mode} mode with good prompt benefits from stronger model`);
  }

  // Rule 6: Low score → don't waste money on expensive model
  if (input.score <= 4 && tier === "high") {
    tier = "mid";
    explanations.push("Downgraded: prompt quality too low to justify high-tier model");
  }

  // Default explanation if nothing fired
  if (explanations.length === 0) {
    explanations.push("Standard task, cost-efficient model sufficient");
  }

  const reason = explanations[0];
  const estimatedCostUsd = 0; // filled by caller with actual token count
  const { modelName, provider } = TIER_MODELS[tier];

  return { tier, modelName, provider, reason, explanations, estimatedCostUsd };
}

/**
 * Calculate estimated cost given a token count and tier.
 */
export function estimateCost(estimatedTokens: number, tier: RouteResult["tier"]): number {
  return parseFloat(((estimatedTokens / 1000) * COST_PER_1K[tier]).toFixed(4));
}
