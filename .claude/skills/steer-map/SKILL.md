---
description: "Rebuild or query the codebase map"
argument-hint: "[module-name]"
---

Use the `mcp__steer__steer_map` tool to interact with the codebase map.

Arguments provided: $ARGUMENTS

If a module name was provided, query the map for that module. Otherwise, ask the user if they want to rebuild the map or query a specific module.

## Pre-check
Before calling the MCP tool, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."
