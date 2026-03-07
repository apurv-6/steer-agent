import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { findSteerDir } from "@steer-agent-tool/core";

interface HistoryRecord {
  taskId: string;
  mode: string;
  round?: number;
  rounds?: number;
  fpcr?: boolean;
  completedFirstRound?: boolean;
  overrideUsed?: boolean;
  modelTier?: string;
  modelUsed?: string;
  score?: number;
  completedAt?: string;
  durationMs?: number;
  totalTime?: string;
  resolution?: string;
}

export async function runMetrics(): Promise<void> {
  const cwd = process.cwd();
  const steerDir = findSteerDir(cwd);
  const historyPath = steerDir
    ? join(steerDir, "state", "history.jsonl")
    : join(cwd, ".steer", "state", "history.jsonl");

  if (!existsSync(historyPath)) {
    console.log("No task history found. Complete tasks with steer.learn to start building metrics.");
    return;
  }

  const raw = await readFile(historyPath, "utf-8");
  const lines = raw.trim().split("\n").filter(Boolean);
  if (lines.length === 0) {
    console.log("No task data found.");
    return;
  }

  const records: HistoryRecord[] = lines.map((l) => JSON.parse(l));
  const total = records.length;

  // FPCR: check fpcr field directly, fall back to legacy fields
  const fpcrPassed = records.filter((r) =>
    r.fpcr === true ||
    (r.completedFirstRound === true && !r.overrideUsed) ||
    r.resolution === "passed"
  ).length;
  const fpcrRate = ((fpcrPassed / total) * 100).toFixed(1);

  // Average rounds
  const avgRounds = (
    records.reduce((s, r) => s + ((r.rounds ?? r.round ?? 0) + 1), 0) / total
  ).toFixed(1);

  // Model tier distribution
  const tierCounts: Record<string, number> = {};
  for (const r of records) {
    const tier = r.modelTier ?? r.modelUsed ?? "unknown";
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
  }

  const highTierCount = (tierCounts["high"] ?? 0);
  const highTierPct = ((highTierCount / total) * 100).toFixed(1);

  // Print summary
  console.log("\n=== Steer Agent Metrics ===\n");
  console.log(`  Tasks completed:             ${total}`);
  console.log(`  First-pass completion rate:  ${fpcrRate}%`);
  console.log(`  Avg rounds per task:         ${avgRounds}`);
  console.log(`  High-tier model usage:       ${highTierPct}%`);

  // Per-task table
  console.log("\n--- Per Task ---\n");
  console.log("  TaskId".padEnd(38) + "Rounds".padEnd(8) + "FPCR".padEnd(8) + "Tier".padEnd(8) + "Override");
  console.log("  " + "-".repeat(62));
  for (const r of records) {
    const rounds = (r.rounds ?? r.round ?? 0) + 1;
    const fpcr = r.fpcr === true || (r.completedFirstRound === true && !r.overrideUsed) || r.resolution === "passed";
    const tier = r.modelTier ?? r.modelUsed ?? "—";
    console.log(
      `  ${(r.taskId ?? "").slice(0, 34).padEnd(36)}` +
      `${String(rounds).padEnd(8)}` +
      `${(fpcr ? "yes" : "no").padEnd(8)}` +
      `${tier.padEnd(8)}` +
      `${r.overrideUsed ? "YES" : "no"}`,
    );
  }
  console.log();
}
