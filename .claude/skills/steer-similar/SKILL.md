---
description: "Find similar past tasks from history"
argument-hint: "[goal description]"
---

Find similar past tasks using the `mcp__steer__steer_similar` tool.

Arguments provided: $ARGUMENTS

If a goal was provided, search for similar tasks with that goal. Otherwise, ask the user what they're looking for.

## Pre-check
Before calling the MCP tool, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."
