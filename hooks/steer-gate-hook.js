#!/usr/bin/env node

/**
 * Cursor beforeSubmitPrompt Hook — SteerAgent Gate
 *
 * Hook event: beforeSubmitPrompt
 * Input: JSON on stdin with { prompt, ... }
 * Output: JSON on stdout { continue: boolean, user_message?: string }
 *
 * Blocking policy:
 *   score <= 3: BLOCKED → continue: false (hard gate)
 *   score 4-6:  NEEDS_INFO → continue: true + user_message with follow-ups
 *   score >= 7: READY → continue: true
 *
 * Setup: Add to ~/.cursor/hooks.json (see hooks/cursor-hooks.example.json)
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const HOOKS_DIR = __dirname;
const PROJECT_ROOT = path.resolve(HOOKS_DIR, "..");
const CORE_CJS = path.resolve(PROJECT_ROOT, "packages", "core", "dist", "index.cjs");

// Read stdin
let stdinData = "";
try {
  stdinData = fs.readFileSync("/dev/stdin", "utf-8");
} catch {
  // No stdin
}

// Extract prompt
let promptText = "";
try {
  const ctx = JSON.parse(stdinData);
  promptText = ctx.prompt || ctx.query || ctx.message || ctx.content || "";
} catch {
  promptText = stdinData.trim();
}

// Env fallback
if (!promptText) {
  promptText = process.env.STEER_DRAFT_PROMPT || process.env.CURSOR_PROMPT || "";
}

// No prompt — allow through with guidance
if (!promptText) {
  process.stdout.write(JSON.stringify({
    continue: true,
    user_message: "[Steer] No prompt text detected. Use /steer in chat to gate prompts.",
  }));
  process.exit(0);
}

// Load core
let gate;
try {
  const core = require(CORE_CJS);
  gate = core.gate;
} catch (e) {
  process.stdout.write(JSON.stringify({
    continue: true,
    user_message: `[Steer] Core not built. Run \`npm run build\` in steer-agent-tool. (${e.message})`,
  }));
  process.exit(0);
}

// Mode from env or default
const mode = process.env.STEER_MODE || "dev";

// Git diff for impact analysis
let gitDiffStat = "";
let gitDiffNameOnly = "";
try {
  gitDiffStat = execSync("git diff --stat 2>/dev/null", { encoding: "utf-8", timeout: 3000 });
  gitDiffNameOnly = execSync("git diff --name-only 2>/dev/null", { encoding: "utf-8", timeout: 3000 });
} catch {
  // Not in git repo or no changes
}

// Critical paths config
let criticalPaths = [];
try {
  const configPath = path.resolve(process.cwd(), "criticalModules.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  criticalPaths = config.paths || config.modules || config;
} catch {
  // No config
}

// Run the gate
const gateResult = gate({
  draftPrompt: promptText,
  mode,
  gitDiffStat: gitDiffStat || undefined,
  gitDiffNameOnly: gitDiffNameOnly || undefined,
  criticalPaths: criticalPaths.length > 0 ? criticalPaths : undefined,
});

// Write bridge file for the Cursor extension to pick up
try {
  const steerDir = path.resolve(PROJECT_ROOT, ".steer");
  fs.mkdirSync(steerDir, { recursive: true });
  fs.writeFileSync(
    path.join(steerDir, "last-gate.json"),
    JSON.stringify({ timestamp: Date.now(), draftPrompt: promptText, gateResult, mode }),
  );
} catch {
  // Best-effort — never block the hook
}

// Build output
let hookOutput;

if (gateResult.status === "BLOCKED") {
  const questions = gateResult.followupQuestions
    .map((q, i) => `  ${i + 1}. ${q.question}`)
    .join("\n");

  hookOutput = {
    continue: false,
    user_message: [
      `[Steer BLOCKED] Score: ${gateResult.score}/10`,
      `Missing: ${gateResult.missing.join(", ")}`,
      "",
      "Add these sections to your prompt:",
      ...gateResult.missing.map((m) => `  ## ${m}`),
      questions ? `\nAnswer these:\n${questions}` : "",
      "",
      "Use /steer in chat to iterate.",
    ].filter(Boolean).join("\n"),
  };
} else if (gateResult.status === "NEEDS_INFO") {
  const questions = gateResult.followupQuestions
    .map((q, i) => `  ${i + 1}. ${q.question}`)
    .join("\n");

  hookOutput = {
    continue: true,
    user_message: [
      `[Steer] Score: ${gateResult.score}/10 | ${gateResult.modelSuggestion.tier.toUpperCase()} | ~$${gateResult.costEstimate.estimatedCostUsd.toFixed(4)}`,
      questions ? `Consider:\n${questions}` : "",
    ].filter(Boolean).join("\n"),
  };
} else {
  hookOutput = {
    continue: true,
    user_message: `[Steer] Score: ${gateResult.score}/10 | ${gateResult.modelSuggestion.tier.toUpperCase()} | ~$${gateResult.costEstimate.estimatedCostUsd.toFixed(4)}`,
  };
}

process.stdout.write(JSON.stringify(hookOutput));
