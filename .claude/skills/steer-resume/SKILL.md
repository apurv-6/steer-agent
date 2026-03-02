---
description: "Resume an interrupted SteerAgent task"
---

Resume the last interrupted task using the `mcp__steer__steer_resume` tool. Present the restored context to the user.

## Pre-check
Before calling the MCP tool, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."
