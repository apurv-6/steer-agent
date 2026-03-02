---
description: "Extract learnings from a completed task"
argument-hint: "[task-id]"
---

Extract learnings from a completed task using the `mcp__steer__steer_learn` tool.

Arguments provided: $ARGUMENTS

If a task ID was provided, use it. Otherwise, check current task status first to get the taskId.

## Pre-check
Before calling the MCP tool, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."
