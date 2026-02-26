import * as fs from "node:fs";
import * as path from "node:path";
import type { TemplateSpec } from "./types.js";

/**
 * Parse simple YAML frontmatter from a template file.
 * Format: --- \n key: value \n --- \n markdown body
 * Handles arrays as [item1, item2] or comma-separated.
 */
function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") {
    return { meta: {}, body: content };
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    return { meta: {}, body: content };
  }

  const meta: Record<string, unknown> = {};
  for (let i = 1; i < endIdx; i++) {
    const line = lines[i]!;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();

    // Parse arrays: [a, b, c]
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    // Parse booleans
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    // Parse numbers
    else if (typeof value === "string" && /^\d+$/.test(value)) {
      value = parseInt(value, 10);
    }

    meta[key] = value;
  }

  const body = lines.slice(endIdx + 1).join("\n").trim();
  return { meta, body };
}

/**
 * Extract follow-up questions from the markdown body.
 * Format: ## Follow-up questions ... \n- field: "question text"
 */
function extractFollowUpQuestions(body: string): Record<string, string> {
  const questions: Record<string, string> = {};
  const lines = body.split("\n");
  let inSection = false;

  for (const line of lines) {
    if (/^##\s+follow-?up\s+questions/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("##")) {
      break; // Next section
    }
    if (inSection && line.startsWith("- ")) {
      const match = line.match(/^-\s+(\w+):\s*"(.+)"\s*$/);
      if (match) {
        questions[match[1]!] = match[2]!;
      }
    }
  }

  return questions;
}

/**
 * Extract the prompt template section from the markdown body.
 * Format: ## Prompt template: \n content...
 */
function extractPromptTemplate(body: string): string {
  const lines = body.split("\n");
  let inSection = false;
  const templateLines: string[] = [];

  for (const line of lines) {
    if (/^##\s+prompt\s+template/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) {
      break;
    }
    if (inSection) {
      templateLines.push(line);
    }
  }

  return templateLines.join("\n").trim();
}

/**
 * Load and parse a template file for the given mode.
 */
export function loadTemplate(mode: string, templatesDir: string): TemplateSpec | null {
  const templatePath = path.join(templatesDir, `${mode}.md`);
  if (!fs.existsSync(templatePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(templatePath, "utf-8");
    const { meta, body } = parseFrontmatter(content);

    return {
      mode: (meta.mode as string) ?? mode,
      required_fields: (meta.required_fields as string[]) ?? [],
      optional_fields: (meta.optional_fields as string[]) ?? [],
      model_bias: (meta.model_bias as string) ?? "mid",
      plan_required: (meta.plan_required as boolean) ?? true,
      verification_required: (meta.verification_required as boolean) ?? true,
      reflection_enabled: (meta.reflection_enabled as boolean) ?? false,
      auto_fetch: (meta.auto_fetch as string[]) ?? [],
      followUpQuestions: extractFollowUpQuestions(body),
      promptTemplate: extractPromptTemplate(body),
    };
  } catch {
    return null;
  }
}

/**
 * Given a template spec and fields already provided, generate follow-up questions.
 * Returns only questions for missing required fields.
 */
export function generateTemplateQuestions(
  spec: TemplateSpec,
  providedFields: Record<string, string>,
): Array<{ id: string; question: string; type: "text" | "mcq"; required: boolean }> {
  const questions: Array<{ id: string; question: string; type: "text" | "mcq"; required: boolean }> = [];

  for (const field of spec.required_fields) {
    if (providedFields[field]) continue; // Already answered
    const question = spec.followUpQuestions[field] ?? `What is the ${field.replace(/_/g, " ")}?`;
    questions.push({
      id: field,
      question,
      type: "text",
      required: true,
    });
  }

  // Cap at 3 questions per spec philosophy
  return questions.slice(0, 3);
}

/**
 * Render a prompt template by substituting {placeholder} tokens.
 */
export function renderPrompt(
  spec: TemplateSpec,
  context: Record<string, string | undefined>,
): string {
  let prompt = spec.promptTemplate;
  for (const [key, value] of Object.entries(context)) {
    if (value != null) {
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
  }
  // Remove unfilled placeholders
  prompt = prompt.replace(/\{[a-z_]+\}/gi, "");
  // Clean up empty lines left by removed placeholders
  prompt = prompt
    .split("\n")
    .filter((line) => line.trim().length > 0 || line === "")
    .join("\n");
  return prompt;
}

export { parseFrontmatter, extractFollowUpQuestions, extractPromptTemplate };
