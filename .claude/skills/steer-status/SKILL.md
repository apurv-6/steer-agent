---
description: "Check current SteerAgent task progress"
---

Get the current task progress using the `mcp__steer__steer_status` tool. Present the results clearly: current step, timing, files touched, and sources used.

## Pre-check
Before calling the MCP tool, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."
