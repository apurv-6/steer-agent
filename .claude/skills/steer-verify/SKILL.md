---
description: "Run verification checklist against acceptance criteria"
---

Run verification checks on the current SteerAgent task.

## Pre-check
Before running the command, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."

## Execution

Run the verification via Bash:
```
steer-agent workflow verify
```

Parse the JSON output and present the verification results (passed/failed checks, summary) to the user.
