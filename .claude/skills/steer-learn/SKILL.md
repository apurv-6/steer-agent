---
description: "Extract learnings from a completed task"
argument-hint: "[task-id]"
---

Extract learnings from a completed task and persist them to knowledge files.

Arguments provided: $ARGUMENTS

If a task ID was provided, use it. Otherwise, the current active task will be used.

## Pre-check
Before running the command, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."

## Execution

Run the learning extraction via Bash:
```
steer-agent workflow learn
```

Parse the JSON output and present the extracted learnings (categories, summaries, modules) to the user.
