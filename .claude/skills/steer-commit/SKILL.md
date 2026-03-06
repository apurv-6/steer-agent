---
description: "Generate a commit message from current task state"
---

Generate a Conventional Commits message using the `mcp__steer__steer_commit` tool.

Check current task status to get the taskId, then generate the commit message and present it to the user.

## Pre-check
Before calling the MCP tool, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."
