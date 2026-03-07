---
description: "Begin execution of an approved plan"
---

Execute the current SteerAgent task plan.

## Pre-check
Before running the command, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."

## Execution

1. First check task status via Bash to confirm there's a plan ready:
   ```
   steer-agent workflow status
   ```

2. Then transition to execution via Bash:
   ```
   steer-agent workflow execute --approved
   ```

3. Parse the JSON output — it includes implementation steps and acceptance criteria. Present them to the user and begin implementing.
