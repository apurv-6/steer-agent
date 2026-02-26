import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  loadTemplate,
  generateTemplateQuestions,
  renderPrompt,
  parseFrontmatter,
  extractFollowUpQuestions,
  extractPromptTemplate,
} from "../templateLoader.js";
import { DEFAULT_TEMPLATES } from "../defaultTemplates.js";

let tmpDir: string;
let templatesDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "steer-tpl-"));
  templatesDir = path.join(tmpDir, "templates");
  fs.mkdirSync(templatesDir, { recursive: true });
  for (const [name, content] of Object.entries(DEFAULT_TEMPLATES)) {
    fs.writeFileSync(path.join(templatesDir, name), content);
  }
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("parseFrontmatter", () => {
  it("parses key-value pairs from YAML frontmatter", () => {
    const content = `---
mode: bugfix
plan_required: true
model_bias: mid
required_fields: [goal, repro_steps]
---
Body content here`;

    const { meta, body } = parseFrontmatter(content);
    expect(meta.mode).toBe("bugfix");
    expect(meta.plan_required).toBe(true);
    expect(meta.model_bias).toBe("mid");
    expect(meta.required_fields).toEqual(["goal", "repro_steps"]);
    expect(body).toBe("Body content here");
  });

  it("returns full content as body when no frontmatter", () => {
    const content = "Just plain markdown";
    const { meta, body } = parseFrontmatter(content);
    expect(meta).toEqual({});
    expect(body).toBe("Just plain markdown");
  });

  it("handles empty arrays", () => {
    const content = `---
fields: []
---
Body`;
    const { meta } = parseFrontmatter(content);
    expect(meta.fields).toEqual([]);
  });

  it("parses false booleans", () => {
    const content = `---
enabled: false
---
`;
    const { meta } = parseFrontmatter(content);
    expect(meta.enabled).toBe(false);
  });
});

describe("extractFollowUpQuestions", () => {
  it("extracts questions from markdown section", () => {
    const body = `## Follow-up questions
- goal: "What exact behavior must change?"
- affected_files: "Which files are involved?"

## Prompt template
GOAL: {goal}`;

    const questions = extractFollowUpQuestions(body);
    expect(questions.goal).toBe("What exact behavior must change?");
    expect(questions.affected_files).toBe("Which files are involved?");
  });

  it("returns empty for missing section", () => {
    const body = "## Other section\nSome content";
    const questions = extractFollowUpQuestions(body);
    expect(Object.keys(questions)).toHaveLength(0);
  });
});

describe("extractPromptTemplate", () => {
  it("extracts prompt template section", () => {
    const body = `## Follow-up questions
- goal: "What?"

## Prompt template
GOAL: {goal}
CONTEXT: {context}
OUTPUT: Patch diff`;

    const template = extractPromptTemplate(body);
    expect(template).toContain("GOAL: {goal}");
    expect(template).toContain("CONTEXT: {context}");
    expect(template).toContain("OUTPUT: Patch diff");
  });

  it("returns empty string when no template section", () => {
    const body = "## Other\nContent";
    const template = extractPromptTemplate(body);
    expect(template).toBe("");
  });
});

describe("loadTemplate", () => {
  it("loads bugfix template with all fields", () => {
    const spec = loadTemplate("bugfix", templatesDir);
    expect(spec).not.toBeNull();
    expect(spec!.mode).toBe("bugfix");
    expect(spec!.required_fields).toContain("goal");
    expect(spec!.required_fields).toContain("repro_steps");
    expect(spec!.model_bias).toBe("mid");
    expect(spec!.plan_required).toBe(true);
    expect(spec!.verification_required).toBe(true);
    expect(spec!.followUpQuestions.goal).toBeDefined();
    expect(spec!.promptTemplate).toContain("GOAL:");
  });

  it("loads all 5 default templates", () => {
    for (const mode of ["bugfix", "feature", "refactor", "design", "debug"]) {
      const spec = loadTemplate(mode, templatesDir);
      expect(spec, `Template ${mode} should load`).not.toBeNull();
      expect(spec!.mode).toBe(mode);
      expect(spec!.required_fields.length).toBeGreaterThan(0);
    }
  });

  it("returns null for missing template", () => {
    const spec = loadTemplate("nonexistent", templatesDir);
    expect(spec).toBeNull();
  });

  it("feature template has high model_bias", () => {
    const spec = loadTemplate("feature", templatesDir);
    expect(spec!.model_bias).toBe("high");
  });

  it("design template has verification_required false", () => {
    const spec = loadTemplate("design", templatesDir);
    expect(spec!.verification_required).toBe(false);
  });
});

describe("generateTemplateQuestions", () => {
  it("generates questions for missing required fields", () => {
    const spec = loadTemplate("bugfix", templatesDir)!;
    const questions = generateTemplateQuestions(spec, {});

    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(3); // Max 3
    expect(questions.every((q) => q.required)).toBe(true);
  });

  it("skips fields already provided", () => {
    const spec = loadTemplate("bugfix", templatesDir)!;
    const questions = generateTemplateQuestions(spec, {
      goal: "Fix login",
      affected_files: "auth.ts",
      repro_steps: "Click login",
      acceptance_criteria: "Login works",
    });

    expect(questions.length).toBe(0);
  });

  it("caps at 3 questions max", () => {
    const spec = loadTemplate("bugfix", templatesDir)!;
    // bugfix has 4 required fields, should cap at 3
    const questions = generateTemplateQuestions(spec, {});
    expect(questions.length).toBe(3);
  });

  it("uses template-defined question text when available", () => {
    const spec = loadTemplate("bugfix", templatesDir)!;
    const questions = generateTemplateQuestions(spec, {});
    const goalQ = questions.find((q) => q.id === "goal");
    if (goalQ) {
      expect(goalQ.question).toBe("What exact behavior must change?");
    }
  });
});

describe("renderPrompt", () => {
  it("substitutes placeholders with context values", () => {
    const spec = loadTemplate("bugfix", templatesDir)!;
    const rendered = renderPrompt(spec, {
      goal: "Fix null pointer",
      repro_steps: "Click button → crash",
      affected_files: "auth.ts, login.ts",
      acceptance_criteria: "No crash on login",
    });

    expect(rendered).toContain("Fix null pointer");
    expect(rendered).toContain("Click button");
    expect(rendered).toContain("auth.ts, login.ts");
    expect(rendered).toContain("No crash on login");
  });

  it("removes unfilled placeholders", () => {
    const spec = loadTemplate("bugfix", templatesDir)!;
    const rendered = renderPrompt(spec, {
      goal: "Fix crash",
    });

    expect(rendered).toContain("Fix crash");
    // Unfilled placeholders like {jira_context} should be removed
    expect(rendered).not.toContain("{jira_context}");
    expect(rendered).not.toContain("{sentry_context}");
  });
});
