---
description: "Score a draft prompt, get follow-ups, and suggest model tier"
argument-hint: "[draft prompt text]"
---

Score the user's draft prompt using the `mcp__steer__steer_gate` tool.

Draft prompt: $ARGUMENTS

If no prompt was provided in arguments, ask the user for their draft prompt.
Pass the prompt to steer_gate and present the results: score, follow-up questions, patched prompt, suggested model tier, and estimated cost.
