---
description: "Preview change impact for a set of files"
argument-hint: "[file paths]"
---

Preview the change impact using the `mcp__steer__steer_impact` tool.

Files provided: $ARGUMENTS

If file paths were provided, analyze their impact. Otherwise, ask the user which files they want to analyze.

## Pre-check
Before calling the MCP tool, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."
