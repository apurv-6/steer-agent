import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

interface TelemetryRecord {
  timestamp: string;
  event: string;
  taskId?: string;
  gateCallCount?: number;
  finalScore?: number;
  modelTier?: string;
  overrideUsed?: boolean;
  [key: string]: unknown;
}

interface TaskMetrics {
  taskId: string;
  gateCallCount: number;
  firstScore: number | null;
  finalScore: number | null;
  modelTier: string | null;
  overrideUsed: boolean;
}

export async function runMetrics(filePath: string = "./data/telemetry.jsonl"): Promise<void> {
  if (!existsSync(filePath)) {
    console.log("No telemetry data found at", filePath);
    return;
  }

  const raw = await readFile(filePath, "utf-8");
  const lines = raw.trim().split("\n").filter(Boolean);
  const records: TelemetryRecord[] = lines.map((l) => JSON.parse(l));

  // Group by taskId
  const tasks = new Map<string, TelemetryRecord[]>();
  for (const r of records) {
    const id = r.taskId ?? "unknown";
    if (!tasks.has(id)) tasks.set(id, []);
    tasks.get(id)!.push(r);
  }

  const taskMetrics: TaskMetrics[] = [];
  for (const [taskId, events] of tasks) {
    const applyEvents = events.filter((e) => e.event === "applyToChat");
    const scores = applyEvents.map((e) => e.finalScore).filter((s): s is number => s != null);
    taskMetrics.push({
      taskId,
      gateCallCount: applyEvents[0]?.gateCallCount ?? 0,
      firstScore: scores[0] ?? null,
      finalScore: scores[scores.length - 1] ?? null,
      modelTier: applyEvents[applyEvents.length - 1]?.modelTier ?? null,
      overrideUsed: applyEvents.some((e) => e.overrideUsed === true),
    });
  }

  // Compute aggregate metrics
  const total = taskMetrics.length;
  if (total === 0) {
    console.log("No task data found.");
    return;
  }

  const firstPassComplete = taskMetrics.filter((t) => t.gateCallCount <= 1 && (t.finalScore ?? 0) >= 7).length;
  const firstPassRate = ((firstPassComplete / total) * 100).toFixed(1);

  const avgGateCalls = (taskMetrics.reduce((s, t) => s + t.gateCallCount, 0) / total).toFixed(1);

  const highTierCount = taskMetrics.filter((t) => t.modelTier === "high").length;
  const highTierPct = ((highTierCount / total) * 100).toFixed(1);

  const improvements = taskMetrics
    .filter((t) => t.firstScore != null && t.finalScore != null)
    .map((t) => t.finalScore! - t.firstScore!);
  const avgImprovement = improvements.length > 0
    ? (improvements.reduce((s, v) => s + v, 0) / improvements.length).toFixed(1)
    : "N/A";

  // Print table
  console.log("\n=== Steer Agent Metrics ===\n");
  console.log(`  Tasks analyzed:              ${total}`);
  console.log(`  First-pass completion rate:  ${firstPassRate}%`);
  console.log(`  Avg gate calls per task:     ${avgGateCalls}`);
  console.log(`  High-tier model usage:       ${highTierPct}%`);
  console.log(`  Avg score improvement:       ${avgImprovement}`);

  console.log("\n--- Per Task ---\n");
  console.log("  TaskId".padEnd(38) + "Gates".padEnd(8) + "First".padEnd(8) + "Final".padEnd(8) + "Tier".padEnd(8) + "Override");
  console.log("  " + "-".repeat(70));
  for (const t of taskMetrics) {
    console.log(
      `  ${(t.taskId ?? "").slice(0, 34).padEnd(36)}` +
      `${String(t.gateCallCount).padEnd(8)}` +
      `${(t.firstScore ?? "—").toString().padEnd(8)}` +
      `${(t.finalScore ?? "—").toString().padEnd(8)}` +
      `${(t.modelTier ?? "—").padEnd(8)}` +
      `${t.overrideUsed ? "YES" : "no"}`,
    );
  }
  console.log();
}
