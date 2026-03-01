---
description: "Create an execution plan for the current task"
argument-hint: "[goal]"
---

Create an execution plan for the current SteerAgent task using the `mcp__steer__steer_plan` tool.

Arguments provided: $ARGUMENTS

If a goal was provided, use it. Otherwise, use the goal from the current task state.
The tool requires a taskId — check current task status first with `mcp__steer__steer_status` if needed.
