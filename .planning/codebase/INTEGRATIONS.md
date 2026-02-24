# External Integrations

**Analysis Date:** 2026-02-24

## APIs & External Services

**Model Context Protocol (MCP):**
- Primary integration point for AI assistants
- SDK: `@modelcontextprotocol/sdk` ^1.12.1
- Implementation: `packages/mcp-server/src/index.ts`
- Transport: stdio (standard input/output)
- Tools exposed: `steer.gate` - evaluates draft prompts

**VS Code/Cursor Extension API:**
- Platform: VS Code Extension API ^1.85.0
- Integration: `packages/cursor-extension/src/extension.ts`
- Features used:
  - Chat Participants (`vscode.chat.createChatParticipant`)
  - Webview Providers (StatusPanel, WizardPanel)
  - Commands (enable, disable, toggle, suggest, applyToChat)
  - Activity Bar Views

## Data Storage

**Databases:**
- None - No database integration

**File Storage:**
- Local filesystem only
- Telemetry: `./data/telemetry.jsonl` (JSONL format)
- Implementation: `packages/core/src/telemetry.ts`

**Caching:**
- None - Stateless computations

## Authentication & Identity

**Auth Provider:**
- None required
- Tool operates locally without authentication

## Monitoring & Observability

**Error Tracking:**
- None - Console-based error output

**Logs:**
- Console logging in extension: `console.log("[steer-agent-tool] ...")`
- Telemetry events appended to local JSONL file

**Telemetry:**
- Local-only telemetry system
- Events: `applyToChat` with taskId, score, modelTier
- File: `./data/telemetry.jsonl`
- Best-effort (errors silently caught)

## CI/CD & Deployment

**Hosting:**
- Not applicable - local developer tool

**CI Pipeline:**
- None detected - No GitHub Actions or similar workflows

**Extension Publishing:**
- Manual via `vsce package --no-dependencies`
- Script: `npm run package` in cursor-extension

## Environment Configuration

**Required env vars:**
- None

**Configuration approach:**
- All configuration is code-based
- Mode selection at runtime (dev, debug, bugfix, design, refactor)
- Session state persisted in VS Code workspace state

## MCP Tool Interface

**Exposed Tool: `steer.gate`**
- Parameters (validated with Zod):
  - `draftPrompt`: string - The draft prompt to evaluate
  - `mode`: enum - "dev" | "debug" | "bugfix" | "design" | "refactor"
- Returns: JSON with score, status, follow-ups, patched prompt, model suggestion, cost estimate

**Transport:**
- stdio server transport (`StdioServerTransport`)
- Started via: `npx steer-agent-tool mcp`

## VS Code Extension Interface

**Commands:**
- `steeragent.enable` - Enable with mode selection
- `steeragent.disable` - Disable steering
- `steeragent.toggle` - Toggle on/off
- `steeragent.suggest` - Run gate evaluation
- `steeragent.applyToChat` - Apply patched prompt to chat

**Chat Participant:**
- ID: `steeragent.steer`
- Usage: `@steer <your prompt>`
- Inline result streaming with buttons

**Views:**
- StatusPanel - Shows current state
- WizardPanel - Interactive prompt wizard

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

---

*Integration audit: 2026-02-24*
