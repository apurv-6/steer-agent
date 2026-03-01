---
description: "Start a new SteerAgent task with context gathering"
argument-hint: "[mode] [task-id]"
---

Start a new SteerAgent task using the `mcp__steer__steer_start` tool.

Arguments provided: $ARGUMENTS

If a mode was provided in the arguments, use it. Valid modes: chat, code, review, plan, design, bugfix, debug, feature, refactor.
If no mode was provided, ask the user which mode they want.
If no task ID was provided, generate a reasonable one based on the mode (e.g., "bugfix-001").

After starting, present the initial questions to the user so they can fill in required fields.
