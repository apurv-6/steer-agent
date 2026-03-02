---
description: "Start a new SteerAgent workflow. Parses specs, roadmaps, and task descriptions. Extracts task details automatically — never asks for info the user already provided."
argument-hint: "[mode] [task-id]"
---

# /steer-start — Start a Governed Workflow

## Pre-check
Before doing anything, verify `.steer/` exists in the project root (or a parent directory).
If not found, stop and inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."

---

## Step 1: Classify the Input

Read the user's input carefully. It falls into one of three categories.

---

### Category A: Structured Spec / Roadmap / Plan

**Detect** when the input contains 3+ of these signals:
- Checkboxes: `□`, `[ ]`, `☐`, `- [ ]`, `✅`, `[x]`, `☑`
- Timeline words: Week, Day, Phase, Sprint, Milestone, Step, Month
- Section headers: `##`, `###`, lines of `---` or `===`, numbered sections like `1.`, `2.`
- File paths or code identifiers: `src/`, `.ts`, `.py`, function names, class names
- Priority/status markers: `P0`, `CRITICAL`, `HIGH`, `TODO`, `PENDING`, `DONE`, `COMPLETED`

**If detected → Run the SPEC PARSER below. Do NOT ask for goal/user story/modules/criteria.**

---

### Category B: Short Task Description (1–3 sentences)

Examples: "fix null pointer in TokenService", "add validation to all API controllers", "steer-agent update command needs to check the npm registry"

**If detected → Proceed directly to Step 2. Do NOT ask for user story or template fields.**
Infer automatically:
- **Goal**: the input text itself
- **Mode**: detect from keywords
  - "fix", "bug", "broken", "error", "patch" → bugfix
  - "implement", "add", "create", "build", "new" → feature
  - "refactor", "restructure", "clean", "simplify" → refactor
  - "debug", "investigate", "trace", "diagnose" → debug
- **Affected files**: search the codebase for relevant files
- **Acceptance criteria**: infer from mode (bug → tests pass, feature → works + tested, refactor → same behavior + cleaner)

---

### Category C: Vague / Ambiguous Input

Examples: "work on auth", "continue the migration", "do the next thing"

**If detected → Ask ONE focused question only.** Never dump a template.
- "What specifically about auth? (fix a bug, add a feature, refactor, review?)"
- "Which migration? I can check `.steer/` for pending items if you share the spec."
- "What's the next task? I can parse a roadmap if you paste it."

---

## SPEC PARSER (for Category A)

When you detect a structured plan/spec/roadmap, do this — never ask for 4 fields:

### 1. Extract all task items

Scan for task-like lines:
- Checkbox lines: `□ Implement steer-agent init`
- Numbered items: `1. Create package.json`
- Bullet points with action verbs under a timeline header

For each task, note:
- **Text**: the task description
- **Status**: DONE (`✅`, `[x]`, `☑`, `COMPLETED`) or PENDING (`□`, `[ ]`, no marker)
- **Group**: which Week / Day / Phase / Section it belongs to

### 2. Determine progress

Count: total tasks, done tasks, pending tasks.
Find the FIRST group with pending tasks.

### 3. Present a compact summary

```
I've parsed your roadmap. X/Y tasks complete.

COMPLETED ([group]):
  ✅ Task A
  ✅ Task B

NEXT ([group]):
  → Task C  ← STARTING HERE
  → Task D
  → Task E

REMAINING ([group]):
  ○ Task F
  ○ Task G
```

### 4. Auto-derive task context for the first pending task

- **Goal**: the task item text
- **Mode**: infer from keywords (see Category B rules above)
- **Affected files**: extract from task text (e.g., "Implement src/cli/update.ts" → `src/cli/update.ts`); also infer from related tasks nearby
- **Acceptance criteria**: infer from mode + any "Test:" or "Verify:" sections in the spec

### 5. Confirm with the user in ONE line (not a template)

```
Starting: "[task text]"
Mode: [mode] | Files: [inferred files]
Ready? (yes / pick a different task / need more context)
```

After the user confirms, call `mcp__steer__steer_start` with the inferred mode and task ID.

---

## Step 2: Context Gathering (after task is identified)

Now that you have the task (from spec parsing or direct input):

1. Call `mcp__steer__steer_start` with the inferred `mode` and a generated `taskId`
2. Present the result's context to the user (rules, codebase summary, similar past tasks)
3. If the MCP tool returns `initialQuestions`, only surface them if the info is GENUINELY missing — never ask for something the user already provided

---

## Anti-Patterns — Never Do These

- **Never** respond to a spec with "Please fill in: 1. Goal 2. User story 3. Modules 4. Criteria"
- **Never** present a blank 4-field template when the user gave you a roadmap
- **Never** ask for all 4 fields at once — if something is missing, ask for ONE thing
- **Never** ignore checkboxes and completion markers in the input
- **Never** ask what mode the user wants if the task text makes it obvious
