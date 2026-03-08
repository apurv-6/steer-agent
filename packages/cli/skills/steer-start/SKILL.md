---
description: "Start a new SteerAgent workflow. Parses specs, roadmaps, and task descriptions. Extracts task details automatically — never asks for info the user already provided."
argument-hint: "[task description]"
---

# /steer-start — Start a Governed Workflow

IMPORTANT: This command starts the FULL 8-step SteerAgent workflow. Every step MUST call its MCP tool. Do NOT skip steps. Do NOT edit code without completing the full workflow.

## Pre-check
Verify `.steer/` exists in the project root. If not, tell the user to run `steer-agent init`.

## When no task is provided
Look at the user's most recent messages for their task description. If there is truly no task context at all, use initialMessage "general development task — awaiting specifics" and mode "dev". Do NOT ask the user — just start the workflow immediately.

## When a task IS provided

You MUST execute ALL of these steps in order. Skipping any step breaks governance.

### Step 1 — CONTEXT (MANDATORY: call mcp__steer__steer_start)
Infer mode from keywords:
- "fix", "bug", "broken", "error" → bugfix
- "add", "create", "build", "new", "implement" → feature
- "refactor", "clean", "simplify" → refactor
- "debug", "investigate" → debug

Call `mcp__steer__steer_start` with `taskId` (generate as `task_<timestamp>`), `mode`, `initialMessage`, `cwd`.

### Step 2 — GATE (MANDATORY: call mcp__steer__steer_gate)
Call `mcp__steer__steer_gate` with `draftPrompt`, `mode`, `taskId`.
Report the score. If BLOCKED, ask user. If NEEDS_INFO, fill answers yourself from context.

### Step 3 — PLANNING (MANDATORY: call mcp__steer__steer_plan)
Read relevant code first. Call `mcp__steer__steer_plan` with `taskId`, `goal`, `files`, `acceptanceCriteria`, `cwd`.
Present plan. WAIT for user approval.

### Step 4 — EXECUTION (MANDATORY: call mcp__steer__steer_execute)
After approval: make code changes, then call `mcp__steer__steer_execute` with `taskId`, `approved: true`, `cwd`.

### Step 5 — REFLECTION
Review changes vs acceptance criteria. Note gaps.

### Step 6 — VERIFICATION (MANDATORY: call mcp__steer__steer_verify)
Call `mcp__steer__steer_verify` with `taskId`, `cwd`. Run tests. Report pass/fail.

### Step 7 — LEARNING (MANDATORY: call mcp__steer__steer_learn)
Call `mcp__steer__steer_learn` with `taskId`, `cwd`.

### Step 8 — OUTPUT
Summarize: what changed, verification results, knowledge captured.

---

REMINDER: You MUST call 6 MCP tools total (start, gate, plan, execute, verify, learn). If you made code changes without calling all 6, you broke the workflow. Go back and call them.
