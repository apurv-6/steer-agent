---
description: "Search and view SteerAgent knowledge files"
argument-hint: "[search query]"
---

Use the `mcp__steer__steer_knowledge` tool to interact with knowledge files.

Arguments provided: $ARGUMENTS

If a query was provided, search for it. Otherwise, list all available knowledge files.

## Pre-check
Before calling the MCP tool, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."
