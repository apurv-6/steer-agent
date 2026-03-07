---
description: "Check current SteerAgent task progress"
---

Get the current task progress. Present the results clearly: current step, timing, files touched, and sources used.

## Pre-check
Before running the command, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."

## Execution

Run via Bash:
```
steer-agent workflow status
```

Parse the JSON output and present it clearly to the user: task ID, mode, current workflow step, progress, elapsed time, files, and model tier.
