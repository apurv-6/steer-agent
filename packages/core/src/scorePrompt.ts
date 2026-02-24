import type { Mode, ScoreResult } from "./types.js";
import { extractFileRefs } from "./extractFileRefs.js";

const VAGUE_VERBS = ["fix", "improve", "help", "check"];
const VAGUE_PATTERN = new RegExp(`\\b(${VAGUE_VERBS.join("|")})\\b`, "gi");

function hasSection(prompt: string, name: string): boolean {
  const pattern = new RegExp(`^##\\s+${name}`, "im");
  return pattern.test(prompt);
}

function hasScopeDefinition(prompt: string): boolean {
  // Scope is defined if LIMITS section exists or explicit scope language is present
  return hasSection(prompt, "LIMITS") || /\b(only|scope|limit(ed)?\s+to)\b/i.test(prompt);
}

export function scorePrompt(draftPrompt: string, mode: Mode): ScoreResult {
  let score = 10;
  const missing: string[] = [];

  if (!hasSection(draftPrompt, "GOAL")) {
    missing.push("GOAL");
    score -= 2;
  }
  if (!hasSection(draftPrompt, "LIMITS")) {
    missing.push("LIMITS");
    score -= 2;
  }
  if (!hasSection(draftPrompt, "REVIEW") && !hasSection(draftPrompt, "VERIFICATION")) {
    missing.push("REVIEW");
    score -= 2;
  }

  const vagueFlags: string[] = [];
  let vagueMatch: RegExpExecArray | null;
  while ((vagueMatch = VAGUE_PATTERN.exec(draftPrompt)) !== null) {
    vagueFlags.push(vagueMatch[1].toLowerCase());
  }
  VAGUE_PATTERN.lastIndex = 0;

  if (vagueFlags.length > 0) {
    score -= 1;
  }

  const fileRefs = extractFileRefs(draftPrompt);

  if (fileRefs.length > 0 && !hasScopeDefinition(draftPrompt)) {
    score -= 1;
  }

  score = Math.max(0, Math.min(10, score));

  return { score, missing, vagueFlags, fileRefs };
}
