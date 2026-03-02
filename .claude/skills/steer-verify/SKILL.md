---
description: "Run verification checklist against acceptance criteria"
---

Run verification on the current SteerAgent task using the `mcp__steer__steer_verify` tool.

Check task status first with `mcp__steer__steer_status` to get the current taskId, then run verification.

## Pre-check
Before calling the MCP tool, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."
