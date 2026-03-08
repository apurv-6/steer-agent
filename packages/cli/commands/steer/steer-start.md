---
name: steer-start
description: Start a new SteerAgent 8-step workflow
argument-hint: "<task description>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Agent
  - mcp__steer__steer_start
  - mcp__steer__steer_gate
  - mcp__steer__steer_plan
  - mcp__steer__steer_execute
  - mcp__steer__steer_verify
  - mcp__steer__steer_learn
  - mcp__steer__steer_map
  - mcp__steer__steer_similar
  - mcp__steer__steer_status
  - mcp__steer__steer_impact
  - mcp__steer__steer_resume
  - mcp__steer__steer_init
---
CRITICAL INSTRUCTION — READ THIS FIRST:
Your VERY FIRST action MUST be calling `mcp__steer__steer_start`. No reading files. No exploring. No asking questions. No launching agents. CALL THE MCP TOOL IMMEDIATELY.

The user's task is: $ARGUMENTS

If the task above is blank: look at the user's most recent messages in the conversation for their task description. If there is truly no task context at all, use initialMessage "general development task — awaiting specifics" and mode "dev". Do NOT ask the user — just start the workflow.

---

## Step 1 — CONTEXT (call mcp__steer__steer_start IMMEDIATELY)

YOUR FIRST TOOL CALL IN THIS ENTIRE RESPONSE MUST BE `mcp__steer__steer_start`. Nothing else first.

Infer mode from keywords:
- "fix", "bug", "broken", "error" → bugfix
- "add", "create", "build", "new", "implement" → feature
- "refactor", "clean", "simplify" → refactor
- "debug", "investigate" → debug
- default → dev

Call `mcp__steer__steer_start` with:
- `taskId`: `task_<unix_timestamp>`
- `mode`: inferred mode
- `initialMessage`: user's task description verbatim
- `cwd`: workspace root

Do NOT proceed until this tool returns.

## Step 2 — GATE (MANDATORY: call mcp__steer__steer_gate)

Call `mcp__steer__steer_gate` with `draftPrompt`, `mode` (dev/debug/bugfix/design/refactor), `taskId`.
Report score. If BLOCKED (<=3), ask user. If NEEDS_INFO, answer follow-ups yourself.

## Step 3 — PLANNING (MANDATORY: call mcp__steer__steer_plan)

Read relevant code. Call `mcp__steer__steer_plan` with `taskId`, `goal`, `files`, `acceptanceCriteria`, `cwd`.
Present plan. WAIT for user approval.

## Step 4 — EXECUTION (MANDATORY: call mcp__steer__steer_execute)

After approval: make code changes, then call `mcp__steer__steer_execute` with `taskId`, `approved: true`, `cwd`.

## Step 5 — REFLECTION

Review changes vs acceptance criteria. Note gaps or risks.

## Step 6 — VERIFICATION (MANDATORY: call mcp__steer__steer_verify)

Call `mcp__steer__steer_verify` with `taskId`, `cwd`. Run tests. Report pass/fail.

## Step 7 — LEARNING (MANDATORY: call mcp__steer__steer_learn)

Call `mcp__steer__steer_learn` with `taskId`, `cwd`.

## Step 8 — OUTPUT

Summarize: what changed, files modified, verification results, knowledge captured.

---

REMINDER: Steps 1, 2, 3, 4, 6, 7 each require an MCP tool call. If you completed the task without calling all 6 tools, you broke the workflow.
