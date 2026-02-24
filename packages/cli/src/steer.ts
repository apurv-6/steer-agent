import { createInterface } from "node:readline";
import * as path from "node:path";
import { gate, type GateResult } from "./gateAdapter.js";
import { telemetry } from "@steer-agent-tool/core";

const CLI_TELEMETRY_PATH = path.resolve(process.cwd(), "data", "telemetry.jsonl");

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function printResult(r: GateResult): void {
  const statusColors: Record<string, string> = {
    BLOCKED: "\x1b[31m",   // red
    NEEDS_INFO: "\x1b[33m", // yellow
    READY: "\x1b[32m",      // green
  };
  const reset = "\x1b[0m";
  const bold = "\x1b[1m";

  console.log(`\n${bold}Status:${reset} ${statusColors[r.status]}${r.status}${reset}  ${bold}Score:${reset} ${r.score}/10`);

  if (r.missing.length) {
    console.log(`${bold}Missing:${reset} ${r.missing.join(", ")}`);
  }
  if (r.followupQuestions.length) {
    console.log(`${bold}Follow-ups:${reset} ${r.followupQuestions.length} question(s)`);
  }

  // Enhanced model display
  console.log(`${bold}Model:${reset} ${r.modelSuggestion.tier.toUpperCase()} — ${r.modelSuggestion.reason}`);
  if (r.modelSuggestion.explanations.length > 1) {
    for (const exp of r.modelSuggestion.explanations) {
      console.log(`  • ${exp}`);
    }
  }
  console.log(`${bold}Cost:${reset} ~$${r.costEstimate.estimatedCostUsd.toFixed(4)} (~${r.costEstimate.estimatedTokens} tokens)`);
  console.log(`${bold}Next:${reset} ${r.nextAction}`);

  if (r.gitImpact) {
    console.log(`${bold}Git:${reset} ${r.gitImpact.filesChanged} files, +${r.gitImpact.insertions}/-${r.gitImpact.deletions}, impact: ${r.gitImpact.impactLevel}`);
    if (r.gitImpact.criticalFilesHit.length > 0) {
      console.log(`  ⚠ Critical: ${r.gitImpact.criticalFilesHit.join(", ")}`);
    }
  }
}

function printPatched(prompt: string): void {
  const dim = "\x1b[2m";
  const reset = "\x1b[0m";
  console.log(`\n${dim}${"─".repeat(50)}${reset}`);
  console.log(prompt);
  console.log(`${dim}${"─".repeat(50)}${reset}`);
}

export async function runSteer(): Promise<void> {
  const bold = "\x1b[1m";
  const reset = "\x1b[0m";

  console.log(`\n${bold}steer-agent-tool${reset} — interactive prompt gate\n`);

  // 1. Pick mode
  const modes = ["dev", "debug", "bugfix", "design", "refactor"];
  console.log("Modes: " + modes.map((m, i) => `${i + 1}) ${m}`).join("  "));
  const modeChoice = await ask("Pick mode [1-5]: ");
  const modeIdx = parseInt(modeChoice, 10) - 1;
  const mode = modes[modeIdx] ?? "dev";
  console.log(`→ Mode: ${mode}\n`);

  // Generate task ID for session
  const taskId = `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let turnId = 0;

  // 2. Enter draft prompt
  console.log("Enter your prompt (empty line to finish):");
  const lines: string[] = [];
  while (true) {
    const line = await ask("");
    if (line === "") break;
    lines.push(line);
  }
  let draftPrompt = lines.join("\n");

  if (!draftPrompt.trim()) {
    console.log("Empty prompt. Exiting.");
    rl.close();
    return;
  }

  // 3. Gate loop
  while (true) {
    turnId++;
    console.log(`\n${bold}── Gate call #${turnId} ──${reset}`);

    const result = gate({
      draftPrompt,
      mode: mode as "dev" | "debug" | "bugfix" | "design" | "refactor",
      taskId,
      turnId,
    });
    printResult(result);

    // Telemetry (best-effort)
    telemetry.append({
      timestamp: new Date().toISOString(),
      taskId: result.taskId,
      turnId: result.turnId,
      mode,
      score: result.score,
      status: result.status,
      missing: result.missing,
      modelTier: result.modelSuggestion.tier,
      estimatedCostUsd: result.costEstimate.estimatedCostUsd,
      hasGitImpact: result.gitImpact !== null,
    }, CLI_TELEMETRY_PATH).catch(() => {});

    // If READY, show patched and offer copy
    if (result.status === "READY") {
      if (result.patchedPrompt) {
        console.log(`\n${bold}Patched prompt:${reset}`);
        printPatched(result.patchedPrompt);

        const copy = await ask("\nCopy to clipboard? [Y/n]: ");
        if (copy.toLowerCase() !== "n") {
          try {
            const { execSync } = await import("node:child_process");
            execSync("pbcopy", { input: result.patchedPrompt });
            console.log("Copied to clipboard!");
          } catch {
            console.log("Could not copy. Here's the prompt above to copy manually.");
          }
        }
      }
      break;
    }

    // If BLOCKED with no follow-ups, nothing to improve
    if (result.status === "BLOCKED" && result.followupQuestions.length === 0) {
      console.log("\nPrompt is too weak. Add GOAL, LIMITS, and REVIEW sections and try again.");
      break;
    }

    // Ask follow-up questions
    if (result.followupQuestions.length > 0) {
      console.log(`\n${bold}Answer these to improve your prompt:${reset}`);
      const answers: string[] = [];
      for (const q of result.followupQuestions) {
        if (q.type === "mcq" && q.options) {
          console.log(`\n${q.question}`);
          q.options.forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
          const choice = await ask("Choice: ");
          const idx = parseInt(choice, 10) - 1;
          answers.push(q.options[idx] ?? q.options[0]);
        } else {
          const answer = await ask(`\n${q.question}\n→ `);
          answers.push(answer);
        }
      }

      // Rebuild prompt with answers injected as sections
      const sections: string[] = [draftPrompt];
      const missing = result.missing;
      let answerIdx = 0;
      if (missing.includes("GOAL") && answerIdx < answers.length) {
        sections.push(`\n## GOAL\n${answers[answerIdx]}`);
        answerIdx++;
      }
      if (missing.includes("LIMITS") && answerIdx < answers.length) {
        sections.push(`\n## LIMITS\n${answers[answerIdx]}`);
        answerIdx++;
      }
      if (missing.includes("REVIEW") && answerIdx < answers.length) {
        sections.push(`\n## REVIEW\n${answers[answerIdx]}`);
        answerIdx++;
      }
      draftPrompt = sections.join("\n");

      const again = await ask("\nRe-run gate? [Y/n]: ");
      if (again.toLowerCase() === "n") break;
    } else {
      break;
    }
  }

  rl.close();
}
