CRITICAL: You MUST call the MCP tools listed below at each step. Do NOT skip steps. Do NOT just do the task directly. The entire point of this workflow is governance — every step MUST go through the MCP server so it gets logged and tracked.

If you skip any MCP tool call, the workflow is broken. Follow every step exactly.

The user's task is: $ARGUMENTS

---

## Step 1 — CONTEXT (MANDATORY: call mcp__steer__steer_start)

You MUST call `mcp__steer__steer_start` with these parameters:
- `taskId`: generate as `task_<unix_timestamp>`
- `mode`: infer from the task (`bugfix`, `feature`, `refactor`, `debug`, or `design`)
- `initialMessage`: the user's task description verbatim
- `cwd`: the current workspace root directory

Do NOT proceed until you have called this tool and received a response.

## Step 2 — GATE (MANDATORY: call mcp__steer__steer_gate)

You MUST call `mcp__steer__steer_gate` with:
- `draftPrompt`: the user's task description
- `mode`: one of `dev`, `debug`, `bugfix`, `design`, `refactor`
- `taskId`: from step 1

Report the score. If score <= 3 (BLOCKED), stop and ask the user for clarification. If NEEDS_INFO, answer follow-ups yourself using context from step 1, then re-call gate with `answers`.

## Step 3 — PLANNING (MANDATORY: call mcp__steer__steer_plan)

You MUST call `mcp__steer__steer_plan` with:
- `taskId`: from step 1
- `goal`: the task description
- `files`: list of files you'll need to modify (read the codebase first to identify these)
- `acceptanceCriteria`: 2-3 measurable criteria derived from the task
- `cwd`: workspace root

Present the plan to the user. WAIT for user approval before proceeding to step 4.

## Step 4 — EXECUTION (MANDATORY: call mcp__steer__steer_execute)

Only after user approves the plan:
1. Write the actual code changes using Read/Edit/Write tools
2. Then call `mcp__steer__steer_execute` with `taskId`, `approved: true`, `cwd`

Both parts are required — the code changes AND the MCP tool call.

## Step 5 — REFLECTION (no tool, but required)

Review your changes against the acceptance criteria from step 3. List:
- What was changed and why
- Any gaps between plan and implementation
- Any risks or side effects

## Step 6 — VERIFICATION (MANDATORY: call mcp__steer__steer_verify)

You MUST call `mcp__steer__steer_verify` with `taskId` and `cwd`.
Also run relevant tests (`npm test`, build checks, etc.) to prove the changes work.
Report pass/fail for each acceptance criterion.

## Step 7 — LEARNING (MANDATORY: call mcp__steer__steer_learn)

You MUST call `mcp__steer__steer_learn` with `taskId` and `cwd`.
This extracts patterns and updates `.steer/knowledge/` for future tasks.

## Step 8 — OUTPUT (summary)

Summarize:
- What was done
- Files changed
- Verification results (pass/fail)
- Knowledge captured

---

REMINDER: Steps 1, 2, 3, 4, 6, 7 each require an MCP tool call. If you completed the task without calling these tools, you did it wrong. Go back and call them.
