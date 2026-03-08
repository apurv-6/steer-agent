---
description: "SteerAgent — show all available steer commands"
---

List all available SteerAgent commands for the user:

| Command | Description |
|---|---|
| `/steer-init` | Initialize `.steer/` folder in current project |
| `/steer-start [mode]` | Start a new task (modes: code, bugfix, debug, refactor, feature, review, plan, design, chat) |
| `/steer-gate [prompt]` | Score a draft prompt, get follow-ups, suggest model tier |
| `/steer-plan` | Create an execution plan for the current task |
| `/steer-execute` | Begin execution of an approved plan |
| `/steer-verify` | Run verification checklist against acceptance criteria |
| `/steer-status` | Check current task progress |
| `/steer-map [module]` | Rebuild or query the codebase map |
| `/steer-impact [files]` | Preview change impact for a set of files |
| `/steer-resume` | Resume an interrupted task |
| `/steer-learn` | Extract learnings from a completed task |
| `/steer-knowledge [query]` | Search and view knowledge files |
| `/steer-commit` | Generate a commit message from current task |
| `/steer-pr` | Generate a PR description from current task |
| `/steer-similar [goal]` | Find similar past tasks |

Ask the user which command they'd like to run.
