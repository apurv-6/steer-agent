# Architecture Patterns

**Domain:** Prompt gating / developer productivity tooling (VS Code/Cursor extension with MCP integration)
**Researched:** 2026-02-24

## Current Architecture Assessment

The existing monorepo has the right component split but lacks a unifying communication layer. Today, each consumer (extension, MCP server, CLI, hook) calls `gate()` independently with no shared session state or cross-component event propagation. The hook cannot notify the extension, the extension cannot influence the MCP server, and telemetry is fire-and-forget to a JSONL file.

**Current flow (disconnected):**
```
Hook (stdin/stdout)  -->  gate()  -->  stdout JSON
Extension (command)  -->  gate()  -->  webview re-render
MCP Server (stdio)   -->  gate()  -->  JSON content block
CLI (interactive)    -->  gate()  -->  console output
```

Each path calls `gate()` but they share nothing at runtime. The v1 architecture must make these feel like one product.

## Recommended Architecture

### Event Bus + Session Store Pattern

Introduce two new primitives in `@steer-agent-tool/core`:

1. **EventBus** -- typed pub/sub for gate lifecycle events
2. **SessionStore** -- in-memory session state with persistence adapter

These sit below all consumers and above the pure functions (scorePrompt, buildPrompt, routeModel). The `gate()` function becomes event-emitting: it publishes events as it executes, and any consumer can subscribe.

### Target Architecture

```
                        +-------------------+
                        |   Cursor Hooks    |
                        | (beforeSubmitPrompt)
                        +--------+----------+
                                 |
                          file-based IPC
                          (signal file)
                                 |
+------------------+    +--------v----------+    +------------------+
|   Status Panel   |<-->|                   |<-->|   Wizard Panel   |
|   (WebviewView)  |    |    Extension      |    |   (WebviewView)  |
+------------------+    |    Host           |    +------------------+
                        |                   |
                        |  SessionStore     |
                        |  EventBus         |
                        |  CommandRouter    |
                        +--------+----------+
                                 |
                        +--------v----------+
                        |  @steer-agent-tool|
                        |     /core         |
                        |                   |
                        |  gate()           |
                        |  scorePrompt()    |
                        |  buildPrompt()    |
                        |  routeModel()     |
                        |  telemetry        |
                        +-------------------+
                                 |
                        +--------v----------+
                        |   MCP Server      |
                        | (steer.gate tool) |
                        +-------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Package |
|-----------|---------------|-------------------|---------|
| **core/gate** | Pure scoring, patching, routing logic. Stateless. | Called by all consumers | `@steer-agent-tool/core` |
| **core/EventBus** | Typed event pub/sub. Decouples producers from consumers. | SessionStore, Extension Host, Telemetry | `@steer-agent-tool/core` |
| **core/SessionStore** | Session lifecycle (task/turn tracking, score trends). Persistence-agnostic. | EventBus, gate(), Extension Host | `@steer-agent-tool/core` |
| **Extension Host** | Orchestrates extension lifecycle. Owns command routing, webview providers, chat participant. Bridges hook signals to EventBus. | All panels, SessionStore, EventBus, Hook bridge | `steer-agent-tool-extension` |
| **StatusPanel** | Read-only sidebar displaying session state (score, mode, trend). Subscribes to state changes. | Extension Host (receives state pushes) | `steer-agent-tool-extension` |
| **WizardPanel** | Interactive panel for follow-up questions, patched prompt review, apply actions. | Extension Host (bidirectional messages) | `steer-agent-tool-extension` |
| **CommandRouter** | Maps VS Code commands to gate operations. Single dispatch point. | Extension Host, SessionStore | `steer-agent-tool-extension` |
| **Hook Bridge** | Watches for hook signal files. Translates external hook events into EventBus events. | FileSystem, EventBus, Extension Host | `steer-agent-tool-extension` |
| **MCP Server** | Exposes `steer.gate` tool over stdio. Stateless relay to core. | core/gate, AI agent (Copilot/Claude) | `@steer-agent-tool/mcp-server` |
| **CLI** | Interactive terminal interface. Standalone. | core/gate, telemetry | `@steer-agent-tool/cli` |
| **Telemetry** | Append-only event log. Subscribes to EventBus for automatic capture. | EventBus, filesystem | `@steer-agent-tool/core` |

## Data Flow

### Primary Flow: Hook-Triggered Gate (v1 target)

This is the "one product" flow where a Cursor hook fires and the extension reacts in real-time.

```
1. User types prompt in Cursor chat
2. Cursor fires beforeSubmitPrompt hook
3. Hook script (steer-gate-hook.js):
   a. Reads stdin JSON (prompt, conversation_id, attachments)
   b. Calls gate() from core
   c. Writes GateResult to signal file (~/.steer-agent/last-gate.json)
   d. Returns { continue: true/false } to Cursor via stdout
4. Extension HookBridge:
   a. FileSystemWatcher detects signal file change
   b. Reads GateResult from signal file
   c. Publishes "gate:result" event on EventBus
5. SessionStore:
   a. Receives "gate:result" event
   b. Updates session state (score, trend, status, turnId)
   c. Fires "session:changed" event
6. StatusPanel:
   a. Receives "session:changed" via state subscription
   b. Re-renders with new score, trend, status
7. WizardPanel:
   a. Receives "gate:result" event
   b. Renders follow-up questions, patched prompt, action buttons
8. User answers follow-ups in WizardPanel:
   a. WizardPanel posts "submitAnswers" message to Extension Host
   b. Extension Host calls gate() with answers
   c. Loop back to step 5
9. User clicks "Apply to Chat":
   a. Extension Host opens chat composer with patched prompt
   b. Telemetry logs apply event
```

### Secondary Flow: @steer Chat Participant

```
1. User types "@steer <prompt>" in VS Code chat
2. Chat participant handler fires
3. Calls gate() directly (no hook involved)
4. Publishes "gate:result" on EventBus
5. Streams results inline via chat response stream
6. SessionStore + panels update via EventBus (same as step 5-7 above)
```

### Secondary Flow: MCP Tool Call

```
1. AI agent calls steer.gate tool via MCP
2. MCP server calls gate() from core
3. Returns GateResult as JSON content block
4. (No EventBus integration -- MCP is stateless stdio, separate process)
```

## Patterns to Follow

### Pattern 1: Typed Event Bus

Use a strongly-typed event emitter in core. This replaces ad-hoc state propagation with a single subscription mechanism.

**What:** Central typed pub/sub that all components subscribe to.
**When:** Any time one component needs to notify others of state changes.

```typescript
// core/src/eventBus.ts
import { EventEmitter } from "node:events";
import type { GateResult, SessionStateData, TelemetryEvent } from "./types.js";

interface EventMap {
  "gate:result": GateResult;
  "gate:error": { error: string; input: unknown };
  "session:changed": SessionStateData;
  "session:reset": void;
  "telemetry:event": TelemetryEvent;
  "hook:signal": { source: "beforeSubmitPrompt"; result: GateResult };
}

class SteerEventBus {
  private emitter = new EventEmitter();

  on<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): void {
    this.emitter.on(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): void {
    this.emitter.off(event, handler);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.emitter.emit(event, data);
  }

  dispose(): void {
    this.emitter.removeAllListeners();
  }
}

// Singleton per process
export const eventBus = new SteerEventBus();
```

**Confidence:** HIGH -- this is standard Node.js EventEmitter wrapped with types. VS Code's own `vscode.EventEmitter` follows the same pattern.

### Pattern 2: Typed Webview Message Protocol

Replace the current untyped `msg.type` switch with a discriminated union.

**What:** Shared message types between extension host and webview.
**When:** All webview communication.

```typescript
// extension/src/messages.ts

// Extension -> Webview
type ToWebviewMessage =
  | { type: "stateUpdate"; data: SessionStateData }
  | { type: "gateResult"; data: GateResult }
  | { type: "error"; message: string };

// Webview -> Extension
type FromWebviewMessage =
  | { type: "submitAnswers"; answers: Record<string, string> }
  | { type: "applyToChat" }
  | { type: "copyPrompt" }
  | { type: "override"; reason: string }
  | { type: "setMode"; mode: GateMode }
  | { type: "ready" };  // webview loaded, request initial state
```

**Confidence:** HIGH -- this is the recommended TypeScript pattern for postMessage APIs. The current codebase already uses a `msg.type` switch; this adds type safety.

### Pattern 3: Command Router (Single Dispatch)

Consolidate all command registrations into a router class instead of scattering `registerCommand` calls through `activate()`.

**What:** A class that maps command IDs to handler functions, reducing activate() complexity.
**When:** Extensions with more than 3-4 commands.

```typescript
// extension/src/commandRouter.ts
import * as vscode from "vscode";

type CommandHandler = (...args: unknown[]) => unknown;

export class CommandRouter {
  private handlers = new Map<string, CommandHandler>();
  private disposables: vscode.Disposable[] = [];

  register(commandId: string, handler: CommandHandler): this {
    this.handlers.set(commandId, handler);
    this.disposables.push(
      vscode.commands.registerCommand(commandId, handler)
    );
    return this;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
```

**Confidence:** HIGH -- standard pattern. The current `activate()` has 5 command registrations inline; this cleans it up and scales.

### Pattern 4: File-Based IPC for Hook-to-Extension Bridge

The Cursor hook runs as a separate Node.js process (spawned by Cursor). It cannot directly communicate with the VS Code extension host. Use a signal file that the hook writes and the extension watches.

**What:** Hook writes GateResult JSON to a known file path. Extension uses `vscode.workspace.createFileSystemWatcher` to detect changes and read the result.
**When:** Bridging the hook process to the extension process.

```typescript
// Shared constant (core/src/constants.ts)
export const SIGNAL_DIR = ".steer-agent";
export const SIGNAL_FILE = "last-gate.json";

// Hook writes:
//   <workspace>/.steer-agent/last-gate.json

// Extension watches:
//   vscode.workspace.createFileSystemWatcher("**/.steer-agent/last-gate.json")
```

**Why file-based and not sockets/IPC:** The hook is a short-lived process (5s timeout). Setting up a socket connection is too heavy. A file write is atomic, debuggable (you can cat the file), and the FileSystemWatcher API is built into VS Code. The hook already runs `execSync` for git; writing a file is comparable overhead.

**Confidence:** MEDIUM -- this pattern works but has a race condition window. The hook could write while the extension is reading. Mitigation: write to a temp file, then rename (atomic on POSIX). Also, this only works when the hook and extension share a workspace root.

### Pattern 5: Session Store with Persistence Adapter

Decouple session state management from VS Code's `workspaceState` Memento. The core SessionStore is pure TypeScript; the extension injects a persistence adapter.

**What:** SessionStore in core holds state in memory. Extension provides a `MementoPersistence` adapter. CLI provides no persistence (ephemeral). This lets the same session logic work across all consumers.

```typescript
// core/src/sessionStore.ts
export interface PersistenceAdapter {
  load(): SessionStateData | undefined;
  save(data: SessionStateData): void;
}

export class SessionStore {
  private state: SessionStateData;

  constructor(
    private persistence?: PersistenceAdapter,
    private bus?: SteerEventBus,
  ) {
    this.state = persistence?.load() ?? DEFAULT_STATE;
  }

  update(partial: Partial<SessionStateData>): void {
    this.state = { ...this.state, ...partial };
    // Auto-track score trend
    if (partial.lastScore != null) {
      this.state.scoreTrend = [...this.state.scoreTrend, partial.lastScore].slice(-10);
    }
    this.persistence?.save(this.state);
    this.bus?.emit("session:changed", this.state);
  }
}
```

**Confidence:** HIGH -- this is the adapter pattern. The current `SessionState` class already does this but is coupled to `vscode.Memento`.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct State Mutation from Webview Messages

**What:** Webview message handler directly calling `sessionState.update()` and `gate()` in the same handler, mixing concerns.
**Why bad:** The current `WizardPanel.handleReEvaluate()` calls `callGate()`, updates `sessionState`, and re-renders all in one method. This means the StatusPanel only learns about changes because it subscribes to `onDidChange`, but the chat participant does not. Adding a new consumer requires touching the WizardPanel.
**Instead:** Webview handler dispatches a command/event. The Extension Host orchestrates the gate call, session update, and notification to all consumers through the EventBus.

### Anti-Pattern 2: HTML String Templates for Webviews

**What:** Building entire HTML pages as template literals in TypeScript (current StatusPanel and WizardPanel).
**Why bad:** No syntax highlighting, no component reuse, XSS risk from manual escaping, painful to maintain as UI grows. The current `esc()` function handles basic HTML escaping but will miss edge cases.
**Instead:** For v1, keep the template approach but extract an `html()` tagged template helper that auto-escapes interpolations. For v2, consider a lightweight framework (Preact or Svelte) compiled to a single JS bundle that the webview loads. Do NOT adopt React for sidebar panels -- it is too heavy for the constrained webview environment.

### Anti-Pattern 3: Synchronous Gate Calls Blocking the Extension Host

**What:** `callGate()` is currently synchronous. This is fine while `gate()` is pure computation, but will break if git operations, file reads, or network calls are added.
**Why bad:** A slow gate call blocks the entire extension host, freezing all UI.
**Instead:** Make `callGate()` async now, even if the underlying `gate()` is sync. This prepares for future async operations (reading `.steeragentrc`, fetching git diff via `child_process`).

### Anti-Pattern 4: Duplicated Type Definitions

**What:** `GateMode` is defined in both `core/src/types.ts` and `extension/src/SessionState.ts`.
**Why bad:** Types drift. The extension's `GateMode` could add a mode that core does not support.
**Instead:** Export all shared types from core. Extension imports from core. The `gateClient.ts` already casts `ExtGateMode as GateMode` -- this cast should be unnecessary.

## Scalability Considerations

| Concern | Current (10 users) | At 100 users | At 1K+ users |
|---------|-------------------|--------------|-------------|
| **Session persistence** | `workspaceState` Memento (per workspace) | Same, works fine | Same -- Memento is per-workspace, no contention |
| **Telemetry storage** | Append-only JSONL file | File grows large; add rotation | Switch to SQLite or ship to external service |
| **Hook signal file** | Single file, one workspace | Works -- each workspace has its own `.steer-agent/` | Works -- file-per-workspace scales horizontally |
| **EventBus** | In-process, zero overhead | Same | Same -- single extension host per window |
| **MCP Server** | stdio, one connection | One server per AI client | Each client spawns its own server process; stateless, scales naturally |
| **Webview rendering** | Full HTML replacement on every state change | Noticeable flicker with complex UIs | Must switch to incremental DOM updates (Preact/Svelte) |

## Build Order (Dependency Graph)

The architecture has clear dependency layers that dictate build order:

```
Phase 1: Core Infrastructure (no external dependencies)
  1a. core/EventBus          -- standalone, no deps
  1b. core/SessionStore      -- depends on EventBus
  1c. core/constants         -- signal file paths, shared config

Phase 2: Hook Bridge (depends on Phase 1)
  2a. Hook signal file write -- update steer-gate-hook.js to write signal file
  2b. Extension HookBridge   -- FileSystemWatcher + EventBus integration

Phase 3: Extension Refactor (depends on Phase 1 + 2)
  3a. Typed message protocol -- shared message types
  3b. CommandRouter          -- consolidate command registrations
  3c. Refactor panels        -- subscribe to EventBus instead of direct state

Phase 4: Integration (depends on all above)
  4a. End-to-end flow        -- hook -> bridge -> panels
  4b. Telemetry auto-capture -- subscribe EventBus, remove manual telemetry calls
  4c. MCP server enrichment  -- optionally emit events for embedded MCP
```

**Rationale:** EventBus and SessionStore are pure TypeScript with zero VS Code dependencies. They can be built and tested in isolation. The Hook Bridge is next because it is the critical missing link -- without it, the hook and extension remain disconnected. Extension refactoring comes third because it depends on the new primitives. Integration is last because it validates the full flow.

### Key Dependency Constraints

- **EventBus before SessionStore:** SessionStore emits events; must have bus first.
- **SessionStore before Extension refactor:** Panels subscribe to SessionStore events.
- **Hook signal write before HookBridge:** Bridge needs something to watch.
- **Typed messages before Panel refactor:** Panels need the message protocol.
- **All infrastructure before integration testing:** Cannot test the flow without all pieces.

### What Can Be Parallelized

- Phase 1a and 1c can be done simultaneously.
- Phase 2a (hook changes) and Phase 3a (message types) are independent.
- StatusPanel and WizardPanel refactors are independent of each other within Phase 3c.

## Embedded MCP Server (Future Consideration)

VS Code now supports extensions embedding MCP servers via `contributes.mcpServerDefinitionProviders` in package.json and `vscode.lm.registerMcpServerDefinitionProvider()` at runtime. This would let the extension register the `steer.gate` MCP tool directly, eliminating the need for users to configure a separate stdio MCP server.

**Current approach (keep for now):** Standalone MCP server via stdio, configured in `.cursor/mcp.json` or VS Code settings. This works across all MCP clients (Claude Desktop, Copilot, etc.).

**Future approach (v2):** Embed MCP server in the extension. Declare in package.json:

```json
{
  "contributes": {
    "mcpServerDefinitionProviders": [
      { "id": "steeragent.mcpServer", "label": "SteerAgent Gate" }
    ]
  }
}
```

Register at runtime in `activate()` with the same gate logic. This eliminates a configuration step for VS Code/Copilot users.

**Confidence:** MEDIUM -- this API is GA in VS Code 1.102+ but Cursor's MCP support may differ. The standalone stdio server should remain as a fallback for non-VS Code clients.

## Cursor Hook Limitations (Critical Finding)

**The `beforeSubmitPrompt` hook has significant limitations:**

1. **Cannot inject context** -- the hook can only return `{ continue: boolean }`. It cannot modify the prompt or add system messages. Community feature requests for context injection exist but are unresolved as of late 2025.

2. **Cannot return `user_message`** -- contrary to the current hook implementation which returns `user_message`, GitButler's deep dive and Cursor's docs indicate that `beforeSubmitPrompt` only respects the `continue` field. The `user_message` field may be silently ignored. (The current hook code at `hooks/steer-gate-hook.js` returns `user_message` -- this needs testing to verify if Cursor actually displays it.)

3. **Short-lived process** -- the hook has a 5-second timeout. Git operations and gate scoring must complete within this window.

**Implication for architecture:** The hook's role is limited to (a) blocking low-quality prompts and (b) signaling the extension via the file bridge. The actual prompt improvement flow must happen in the extension (WizardPanel + chat participant), not in the hook.

**Confidence:** MEDIUM -- Cursor's hook API is evolving rapidly. The `user_message` support may have been added after the GitButler analysis. This needs empirical testing.

## Sources

- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview) -- official postMessage documentation
- [VS Code MCP Developer Guide](https://code.visualstudio.com/api/extension-guides/ai/mcp) -- embedded MCP server registration
- [Cursor Hooks Documentation](https://cursor.com/docs/agent/hooks) -- official hook specification
- [GitButler Cursor Hooks Deep Dive](https://blog.gitbutler.com/cursor-hooks-deep-dive) -- real-world hook analysis, stdin/stdout format details
- [VS Code Messenger (TypeFox)](https://www.typefox.io/blog/vs-code-messenger/) -- typed message protocol for webview communication
- [MCP Support GA in VS Code](https://github.blog/changelog/2025-07-14-model-context-protocol-mcp-support-in-vs-code-is-generally-available/) -- MCP server embedding timeline
- [InfoQ: Cursor 1.7 Hooks](https://www.infoq.com/news/2025/10/cursor-hooks/) -- hook lifecycle events overview
- [Adding MCP Server to VS Code Extension](https://www.kenmuse.com/blog/adding-mcp-server-to-vs-code-extension/) -- practical guide for embedded MCP
