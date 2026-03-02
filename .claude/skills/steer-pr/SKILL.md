---
description: "Generate a PR description from current task state"
---

Generate a PR description using the `mcp__steer__steer_pr` tool.

Check current task status to get the taskId, then generate the PR description and present it to the user.

## Pre-check
Before calling the MCP tool, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."
