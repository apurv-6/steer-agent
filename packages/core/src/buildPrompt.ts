import type { ScoreResult } from "./types.js";

export interface BuildPromptAnswers {
  goal?: string;
  limits?: string;
  review?: string;
  outputFormat?: string;
}

export function buildPrompt(
  originalPrompt: string,
  answers: BuildPromptAnswers,
  scoreResult: ScoreResult,
): string {
  const goal = answers.goal ?? (scoreResult.missing.includes("GOAL") ? "" : extractInlineSection(originalPrompt, "GOAL"));
  const review = answers.review ?? (scoreResult.missing.includes("REVIEW") ? "" : extractInlineSection(originalPrompt, "REVIEW"));
  const outputFormat = answers.outputFormat ?? "Return only the final result (unless user overrides).";

  // Build LIMITS with file-scope annotation
  let limits = answers.limits ?? (scoreResult.missing.includes("LIMITS") ? "" : extractInlineSection(originalPrompt, "LIMITS"));
  if (scoreResult.fileRefs.length > 0) {
    const refList = scoreResult.fileRefs.map((r) => `@${r}`).join(", ");
    const scopeLine = `Primary scope: ${refList}. Changes outside must be explicitly justified.`;
    limits = limits ? `${limits}\n${scopeLine}` : scopeLine;
  }

  // Clean original prompt: strip existing section headers for CONTEXT
  const context = stripSectionHeaders(originalPrompt).trim();

  const sections = [
    `GOAL:\n${goal}`,
    `CONTEXT:\n${context}`,
    `LIMITS:\n${limits}`,
    `OUTPUT FORMAT:\n${outputFormat}`,
    `REVIEW:\n${review}`,
  ];

  return sections.join("\n\n") + "\n";
}

function extractInlineSection(prompt: string, sectionName: string): string {
  const pattern = new RegExp(`^##\\s+${sectionName}\\s*\\n([\\s\\S]*?)(?=^##\\s|$)`, "im");
  const match = prompt.match(pattern);
  return match ? match[1].trim() : "";
}

function stripSectionHeaders(prompt: string): string {
  return prompt.replace(/^##\s+\S+.*\n?/gm, "");
}
