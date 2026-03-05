# SteerAgent — High-Level Architecture

## Overview

SteerAgent is a monorepo with 4 packages layered around a file-based state system (`.steer/`). The MCP server owns all logic; the extension is read-only.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER ENVIRONMENT                        │
│                                                                     │
│  ┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │  Claude Code │    │  Cursor / VS Code │    │  Terminal (CLI)  │   │
│  │  (AI agent)  │    │  Sidebar Extension│    │  steer-agent ... │   │
│  └──────┬──────┘    └────────┬─────────┘    └────────┬─────────┘   │
│         │                    │                        │             │
│         │ MCP protocol       │ WebSocket/HTTP         │ direct call │
│         │                    │                        │             │
│  ┌──────▼────────────────────▼────────────────────────▼──────────┐ │
│  │                     packages/mcp-server                        │ │
│  │                                                                │ │
│  │  Tools: start · plan · execute · verify · learn · gate        │ │
│  │         status · resume · similar · map · impact · pr         │ │
│  │         commit · knowledge                                     │ │
│  │                                                                │ │
│  │  Owns ALL logic & state — single source of truth              │ │
│  └───────────────────────────┬────────────────────────────────────┘ │
│                              │ imports                              │
│  ┌───────────────────────────▼────────────────────────────────────┐ │
│  │                      packages/core                             │ │
│  │                                                                │ │
│  │  gate · scorePrompt · routeModel · promptAssembler · state    │ │
│  │  planBuilder · learner · verifier · knowledgeLoader · rag     │ │
│  │  buildPrompt · gitImpact · codemap · telemetry · subagent     │ │
│  └───────────────────────────┬────────────────────────────────────┘ │
│                              │ reads/writes                         │
│  ┌───────────────────────────▼────────────────────────────────────┐ │
│  │                    .steer/  (git-committed)                    │ │
│  │                                                                │ │
│  │  current-task.json   ← single source of truth for task state  │ │
│  │  knowledge/          ← team-shared, compounds over time       │ │
│  │  templates/          ← prompt templates                       │ │
│  │  config.json         ← model routing, thresholds              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   packages/cli                               │   │
│  │  install · uninstall · init · doctor · update · metrics     │   │
│  │  hooks/prompt-submit (UserPromptSubmit → gate check)        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Role |
|---|---|
| `packages/core` | Pure logic library — scoring, routing, planning, learning, RAG |
| `packages/mcp-server` | MCP tool server — exposes all workflow tools to Claude Code |
| `packages/cli` | Install/uninstall, init, doctor, metrics, prompt-submit hook |
| `packages/cursor-extension` | Sidebar UI — read-only view of `.steer/` state |

---

## Data Flow (Normal Task)

```
Developer types prompt
  → prompt-submit hook fires
  → gate scores prompt → routes to model tier (small / mid / high)
  → /steer-start called
  → MCP server invokes core
  → core assembles context from .steer/ (knowledge, codemap, history)
  → plan → execute → verify cycle
  → learner writes back to .steer/knowledge/
  → Extension reflects live state (read-only)
```

---

## 8-Step Workflow

| Step | Description |
|---|---|
| 1. Context | Load `.steer/` state, knowledge, codemap |
| 2. Prompt | Gate scores prompt, routes to model tier |
| 3. Planning | Build task plan with acceptance criteria |
| 4. Execution | Implement changes with atomic commits |
| 5. Reflection | Self-review against plan |
| 6. Verification | Run tests, check acceptance criteria |
| 7. Learning | Write lessons to `.steer/knowledge/` |
| 8. Output | Summarise changes, update `current-task.json` |

---

## Key Design Constraints

- **MCP owns all logic.** Extension never writes to `.steer/` directly.
- **Works without extension.** MCP + `.steer/` = full functionality.
- **Deterministic governance.** No AI in scoring, routing, or gating — all rule-based in `core`.
- **File-based state.** `current-task.json` is the single source of truth.
- **Knowledge compounds.** `.steer/knowledge/` is committed to git and shared across the team.
- **No auto-send.** Developer always confirms before anything is sent.

---

## `.steer/` Folder Structure

```
.steer/
├── current-task.json     # Active task state
├── config.json           # Model routing thresholds, toggles
├── knowledge/            # Team-shared learnings (git-committed)
│   ├── patterns.md
│   └── decisions.md
└── templates/            # Prompt templates
    └── task.md
```

---

## Install Flow

```
npm install -g @coinswitch/steer-agent
  → postinstall runs automatically
  → registers MCP server in ~/.claude/settings.json
  → registers UserPromptSubmit hook
  → copies skills to ~/.claude/skills/
  → installs Cursor/VS Code extension (--no-ext to skip)
```
