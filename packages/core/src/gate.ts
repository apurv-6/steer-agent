import type {
  GateInput,
  GateResult,
  GateStatus,
  GitImpact,
  Mode,
} from "./types.js";
import { MODE_MAP } from "./types.js";
import { scorePrompt } from "./scorePrompt.js";
import { generateFollowUps } from "./generateFollowUps.js";
import { buildPrompt, type BuildPromptAnswers } from "./buildPrompt.js";
import { routeModel, estimateCost } from "./routeModel.js";
import { estimateTokens } from "./estimateTokens.js";
import { parseGitImpact } from "./gitImpact.js";

function deriveStatus(score: number): GateStatus {
  if (score <= 3) return "BLOCKED";
  if (score <= 6) return "NEEDS_INFO";
  return "READY";
}

function deriveNextAction(status: GateStatus, hasFollowups: boolean): GateResult["nextAction"] {
  if (status === "BLOCKED") return "block";
  if (status === "NEEDS_INFO" && hasFollowups) return "answer_questions";
  if (status === "NEEDS_INFO") return "review_and_apply";
  return "apply";
}

/**
 * Canonical gate function. Single source of truth for all consumers
 * (MCP server, CLI, extension, hook bridge).
 */
export function gate(input: GateInput): GateResult {
  const coreMode: Mode = MODE_MAP[input.mode] ?? "code";
  const taskId = input.taskId ?? `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const turnId = input.turnId ?? 1;

  // 1. Score the prompt
  const scoreResult = scorePrompt(input.draftPrompt, coreMode);

  // 2. Generate follow-up questions (mode-aware)
  const followupQuestions = generateFollowUps(scoreResult, coreMode);

  // 3. Derive status
  const status = deriveStatus(scoreResult.score);

  // 4. Build patched prompt (only if score >= 4)
  let patchedPrompt: string | null = null;
  if (scoreResult.score >= 4) {
    const buildAnswers: BuildPromptAnswers = {};
    if (input.answers) {
      // Map answer keys to build prompt fields
      for (const [key, value] of Object.entries(input.answers)) {
        if (!value) continue;
        const k = key.toLowerCase();
        if (k.includes("goal") || k.includes("outcome")) buildAnswers.goal = value;
        else if (k.includes("limit") || k.includes("constraint") || k.includes("scope")) buildAnswers.limits = value;
        else if (k.includes("review") || k.includes("verif") || k.includes("test")) buildAnswers.review = value;
        else if (k.includes("output") || k.includes("format")) buildAnswers.outputFormat = value;
        else {
          // Default: add to goal if goal empty, else limits
          if (!buildAnswers.goal) buildAnswers.goal = value;
          else if (!buildAnswers.limits) buildAnswers.limits = value;
          else if (!buildAnswers.review) buildAnswers.review = value;
        }
      }
    }
    patchedPrompt = buildPrompt(input.draftPrompt, buildAnswers, scoreResult);
  }

  // 5. Parse git impact if provided
  let gitImpact: GitImpact | null = null;
  if (input.gitDiffStat && input.gitDiffNameOnly) {
    gitImpact = parseGitImpact(
      input.gitDiffStat,
      input.gitDiffNameOnly,
      input.criticalPaths ?? [],
    );
  }

  // 6. Route model (git-aware)
  const routeResult = routeModel({
    mode: coreMode,
    score: scoreResult.score,
    gitImpact: gitImpact ?? undefined,
  });

  // 7. Estimate tokens and cost
  const estimatedTokens = estimateTokens(patchedPrompt ?? input.draftPrompt);
  const estimatedCostUsd = estimateCost(estimatedTokens, routeResult.tier);
  routeResult.estimatedCostUsd = estimatedCostUsd;

  // 8. Determine next action
  const nextAction = deriveNextAction(status, followupQuestions.length > 0);

  return {
    taskId,
    turnId,
    status,
    score: scoreResult.score,
    missing: scoreResult.missing,
    followupQuestions,
    patchedPrompt,
    modelSuggestion: routeResult,
    costEstimate: { estimatedTokens, estimatedCostUsd },
    gitImpact,
    nextAction,
  };
}
