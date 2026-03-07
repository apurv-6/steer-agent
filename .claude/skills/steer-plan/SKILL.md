---
description: "Create an execution plan for the current task"
argument-hint: "[goal]"
---

Create an execution plan for the current SteerAgent task.

Arguments provided: $ARGUMENTS

If a goal was provided, use it. Otherwise, use the goal from the current task state.

## Pre-check
Before running the command, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."

## Execution

1. First check task status via Bash:
   ```
   steer-agent workflow status
   ```

2. Then create the plan via Bash:
   ```
   steer-agent workflow plan --goal="<goal>" [--files=file1,file2] [--criteria=c1,c2]
   ```

3. Parse the JSON output and present the plan steps and impact preview to the user for approval.
