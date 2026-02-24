# Phase 1: Core Infrastructure & Pilot Reliability - Research

**Researched:** 2026-02-24
**Domain:** TypeScript monorepo infrastructure -- EventBus, SessionStore, file-based IPC, MCP reliability, telemetry
**Confidence:** HIGH

## Summary

Phase 1 transforms the existing v0.2 codebase from disconnected components into a cohesive product. The core scoring, routing, and patching logic already works and is well-tested. What is missing are the connective primitives: an EventBus for typed event propagation, a SessionStore decoupled from VS Code's Memento, a file-based hook-to-extension bridge, MCP server hardening, and telemetry path correction.

The codebase is in better shape than typical v0.2 code. The `gate()` function in `packages/core/src/gate.ts` already serves as the canonical single source of truth -- MCP, CLI, and extension all delegate to it via thin adapters (`packages/mcp-server/src/gate.ts`, `packages/cli/src/gateAdapter.ts`, `packages/cursor-extension/src/gateClient.ts`). Types are exported from core. The smoke test covers all gate statuses. The main gaps are: (1) no EventBus exists yet, (2) SessionStore is coupled to `vscode.Memento` in the extension, (3) the hook writes stdout but not a signal file, (4) MCP server has no error/signal handlers, (5) telemetry uses a relative path.

**Primary recommendation:** Build EventBus and SessionStore as pure TypeScript in core (zero VS Code dependencies), then wire them through gate(), hook bridge, extension, and telemetry -- in that dependency order.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.3+ | All packages | Already in use. No upgrade required for Phase 1. |
| Node.js EventEmitter | built-in | EventBus foundation | Zero-dependency, proven, ships with Node.js. Wrap with types. |
| Node.js fs/promises | built-in | Signal file write, telemetry append | Already used in telemetry.ts. Sufficient for atomic file ops. |
| vitest | ^3.0.0+ | Unit tests for new primitives | Already configured in core. Add tests for EventBus, SessionStore, HookBridge. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/sdk | ^1.12.1+ | MCP server | Already in use. No upgrade needed for Phase 1 hardening. |
| zod | ^3.24.0 | MCP schema validation | Already in use. Frozen at 3.x per prior decision. |
| esbuild | ^0.27.3 | Extension bundling | Already in use. No change. |
| tsup | ^8.3.6 | Core/CLI/MCP bundling | Already in use. No change. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js EventEmitter (wrapped) | mitt, eventemitter3, nanoevents | External deps add nothing for a typed wrapper over EventEmitter. Mitt is 200 bytes but lacks `removeAllListeners`. EventEmitter is already available. |
| File-based IPC (signal file) | Unix domain socket, named pipe | Socket requires long-lived hook process (hook has 5s timeout). File write is atomic, debuggable (can `cat` the file), and FileSystemWatcher API is built into VS Code. |
| vscode.Memento persistence adapter | SQLite, LevelDB | Memento is free, persistent across restarts, scoped per workspace. No reason to introduce a database for session state. |

**Installation:**
```bash
# No new dependencies needed for Phase 1
# All required libraries are already installed
npm install
npm run build
```

## Architecture Patterns

### Recommended Project Structure

New files to add in Phase 1 (within existing package structure):

```
packages/core/src/
  eventBus.ts          # NEW: Typed EventBus singleton
  sessionStore.ts      # NEW: SessionStore with PersistenceAdapter
  constants.ts         # NEW: Signal file paths, shared constants
  types.ts             # MODIFY: Add SessionStateV1, EventMap types
  gate.ts              # MODIFY: Emit events on EventBus
  telemetry.ts         # MODIFY: Subscribe to EventBus, accept absolute path

packages/cursor-extension/src/
  hookBridge.ts        # NEW: FileSystemWatcher for signal file
  extension.ts         # MODIFY: Wire EventBus, SessionStore, HookBridge
  SessionState.ts      # MODIFY: Implement PersistenceAdapter over vscode.Memento

hooks/
  steer-gate-hook.js   # MODIFY: Write signal file after gate()

packages/mcp-server/src/
  index.ts             # MODIFY: Add error handlers, signal handling, stdout audit
```

### Pattern 1: Typed EventBus (Singleton in Core)

**What:** A thin typed wrapper over Node.js EventEmitter that enforces event name/payload contracts at compile time.
**When to use:** Any time one component needs to notify others. gate() emits `gate:result`, SessionStore emits `session:changed`, HookBridge emits `hook:signal`.

```typescript
// packages/core/src/eventBus.ts
import { EventEmitter } from "node:events";
import type { GateResult, TelemetryEvent } from "./types.js";

// SessionStateData will be defined in types.ts
export interface EventMap {
  "gate:result": GateResult;
  "gate:error": { error: string; input: unknown };
  "session:changed": SessionStateData;
  "session:reset": void;
  "telemetry:event": TelemetryEvent;
  "hook:signal": { source: string; result: GateResult };
}

export class SteerEventBus {
  private emitter = new EventEmitter();

  on<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  off<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.emitter.emit(event, data);
  }

  dispose(): void {
    this.emitter.removeAllListeners();
  }
}

// Singleton -- one bus per process
export const eventBus = new SteerEventBus();
```

**Confidence:** HIGH -- standard Node.js pattern. VS Code's own `vscode.EventEmitter` follows the same approach.

**Important design note:** The EventBus singleton works because extension host, CLI, and hook each run in separate Node.js processes. The MCP server is a separate process too -- it should NOT use the EventBus (per MCP-02: stateless stdio relay). The EventBus connects components within a single process (extension host: panels + session + telemetry + hook bridge).

### Pattern 2: SessionStore with Pluggable Persistence

**What:** In-memory state manager in core that accepts an optional PersistenceAdapter. Extension injects a Memento-based adapter. CLI uses ephemeral (no persistence). The store emits events on the bus when state changes.
**When to use:** Anywhere session state is needed (extension, CLI gate loop).

```typescript
// packages/core/src/sessionStore.ts
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
    this.state = persistence?.load() ?? DEFAULT_SESSION_STATE;
  }

  get data(): Readonly<SessionStateData> {
    return this.state;
  }

  update(partial: Partial<SessionStateData>): void {
    this.state = { ...this.state, ...partial };
    if (partial.lastScore != null) {
      this.state.scoreTrend = [...this.state.scoreTrend, partial.lastScore].slice(-10);
    }
    this.persistence?.save(this.state);
    this.bus?.emit("session:changed", this.state);
  }

  reset(): void {
    this.state = { ...DEFAULT_SESSION_STATE };
    this.persistence?.save(this.state);
    this.bus?.emit("session:reset", undefined as never);
  }
}
```

**Confidence:** HIGH -- adapter pattern. Current `SessionState` class in extension already does the same thing but is coupled to `vscode.Memento`.

### Pattern 3: File-Based Hook-to-Extension Bridge

**What:** The hook writes GateResult JSON to a known signal file. The extension watches it with `vscode.workspace.createFileSystemWatcher`. On change, it reads the file, validates the JSON, and emits `hook:signal` on the EventBus.
**When to use:** Bridging the short-lived hook process to the long-lived extension host.

```typescript
// Signal file path (in constants.ts)
export const SIGNAL_DIR = ".steer-agent";
export const SIGNAL_FILE = "last-gate.json";

// Hook writes to: <workspace>/.steer-agent/last-gate.json
// Extension watches: **/.steer-agent/last-gate.json
```

**Critical implementation detail:** Write to a temp file first, then rename. `fs.renameSync` is atomic on POSIX, preventing the extension from reading a half-written file.

```javascript
// In hook (steer-gate-hook.js) -- CJS
const tmpPath = path.join(signalDir, ".last-gate.tmp");
const finalPath = path.join(signalDir, "last-gate.json");
fs.writeFileSync(tmpPath, JSON.stringify(gateResult));
fs.renameSync(tmpPath, finalPath);
```

**Confidence:** MEDIUM-HIGH -- the pattern is sound but FileSystemWatcher has known quirks: it may fire multiple times for a single write, or miss events if the file is written too fast. Debounce the watcher callback (100ms) and validate file content on each read.

### Pattern 4: MCP Server Hardening

**What:** Add global error handlers, signal handling, stdout audit, and keepalive to the MCP server.
**When to use:** MCP-03, REL-01.

```typescript
// packages/mcp-server/src/index.ts -- additions
// 1. Redirect console.log to stderr
const originalLog = console.log;
console.log = (...args: unknown[]) => {
  console.error("[mcp-log]", ...args);
};

// 2. Global error handlers
process.on("uncaughtException", (err) => {
  console.error("[mcp-fatal]", err);
  // Do NOT exit -- keep server alive
});
process.on("unhandledRejection", (reason) => {
  console.error("[mcp-rejection]", reason);
});

// 3. Signal handling
process.on("SIGINT", () => {
  console.error("[mcp] SIGINT received, shutting down");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.error("[mcp] SIGTERM received, shutting down");
  process.exit(0);
});

// 4. Keep stdin open
process.stdin.resume();
```

**Confidence:** HIGH -- these are standard Node.js process hardening patterns. The MCP specification explicitly warns about stdout corruption from stray console.log calls.

### Pattern 5: Telemetry via EventBus Subscription

**What:** Instead of manual `telemetry.append()` calls scattered across consumers, telemetry subscribes to EventBus events and auto-captures them.
**When to use:** TELE-03.

```typescript
// packages/core/src/telemetry.ts -- new function
export function subscribeToEventBus(bus: SteerEventBus, filePath: string): void {
  bus.on("gate:result", (result) => {
    append({
      timestamp: new Date().toISOString(),
      event: "gate:result",
      taskId: result.taskId,
      turnId: result.turnId,
      score: result.score,
      status: result.status,
      modelTier: result.modelSuggestion.tier,
      costEstimate: result.costEstimate.estimatedCostUsd,
      hasGitImpact: !!result.gitImpact,
      nextAction: result.nextAction,
    }, filePath).catch(() => { /* best-effort */ });
  });
}
```

**Confidence:** HIGH -- replaces existing manual telemetry calls with automatic capture. The `append()` function already exists and handles mkdir/write.

### Anti-Patterns to Avoid

- **Importing vscode in core:** EventBus and SessionStore MUST be pure TypeScript. No `import * as vscode` in core. The extension injects VS Code-specific adapters.
- **EventBus in MCP server:** The MCP server is a separate stdio process. It should NOT subscribe to the EventBus -- it is stateless (MCP-02). Only emit events within the extension host process.
- **Synchronous file reads in watcher callback:** FileSystemWatcher fires on the extension host thread. Use `fs.promises.readFile` (async) in the HookBridge, never `readFileSync`.
- **Multiple signal file watchers:** Create ONE FileSystemWatcher for the signal file pattern, not one per workspace folder.
- **Telemetry in hot path:** `telemetry.append()` is async and should never block gate() execution. Always fire-and-forget.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event pub/sub | Custom observer pattern | Node.js EventEmitter (wrapped) | Battle-tested, handles listener cleanup, memory leak warnings built in |
| File watching | `fs.watch` / polling | `vscode.workspace.createFileSystemWatcher` | VS Code's watcher uses efficient OS-level APIs (FSEvents on macOS, inotify on Linux), handles workspace scope |
| Atomic file write | Manual write + close | Write to tmp + rename | `fs.renameSync` is atomic on POSIX; manual write can leave half-written files |
| Session persistence in extension | Custom IndexedDB/file store | `vscode.Memento` via workspaceState | Free, managed by VS Code, survives restarts, scoped per workspace |
| MCP transport | Custom stdio parsing | `@modelcontextprotocol/sdk` StdioServerTransport | Handles JSON-RPC framing, buffering, error codes correctly |

**Key insight:** Phase 1 is about wiring, not building. Every component already exists in some form. The work is connecting them through EventBus + signal file, not creating new algorithms.

## Common Pitfalls

### Pitfall 1: MCP Stdout Corruption

**What goes wrong:** Any `console.log()` in code paths reachable from the MCP server writes to stdout, corrupting the JSON-RPC stream. The MCP client sees garbled data and disconnects silently.
**Why it happens:** The core library, gate function, or scoring code may have debug logging that writes to stdout. In extension context this is harmless. In MCP context it is fatal.
**How to avoid:** Redirect `console.log` to `console.error` at MCP server startup (before any imports). Audit all core code paths for console.log calls. Add a test that captures stdout during gate() execution and asserts it is empty.
**Warning signs:** MCP client reports "tool not found" or "connection closed" after previously working.

### Pitfall 2: FileSystemWatcher False Positives

**What goes wrong:** The watcher fires multiple times for a single file write (common on macOS FSEvents), causing duplicate gate result processing. Or it fires for unrelated .steer-agent directory changes.
**Why it happens:** OS-level file watchers batch and deduplicate events imperfectly. A write + rename sequence may fire 2-3 events.
**How to avoid:** (1) Debounce the watcher callback by 100-200ms. (2) Read the file content and compare to last-processed content (use a hash or timestamp field in the JSON). (3) Only process if the file contains valid GateResult JSON.
**Warning signs:** StatusPanel updates twice for one hook invocation. Telemetry shows duplicate events.

### Pitfall 3: Telemetry Path Resolution in Extension Context

**What goes wrong:** The current `telemetry.ts` defaults to `./data/telemetry.jsonl` (relative). In VS Code extension context, the working directory is unpredictable. Telemetry silently writes to the wrong location or fails.
**Why it happens:** The extension host's cwd may be the workspace root, the extension directory, or the user home. Relative paths resolve differently in each case.
**How to avoid:** In extension context, use `context.globalStorageUri.fsPath` for the telemetry directory. Pass the absolute path explicitly when calling `telemetry.append()` or `telemetry.subscribeToEventBus()`. In CLI context, resolve from `process.cwd()`.
**Warning signs:** No telemetry file appears where expected. Metrics command shows "No telemetry data found."

### Pitfall 4: EventBus Memory Leaks

**What goes wrong:** Subscribers are added but never removed. Over time (especially with panel hide/show cycles), listeners accumulate. Node.js warns: "MaxListenersExceededWarning: Possible EventEmitter memory leak detected."
**Why it happens:** VS Code webview providers can be resolved and disposed multiple times. If the panel subscribes to EventBus in `resolveWebviewView` without cleaning up on dispose, listeners stack up.
**How to avoid:** (1) Return a disposable from EventBus subscriptions. (2) Clean up subscriptions in the webview provider's dispose. (3) Set `emitter.setMaxListeners(20)` as a safety net with a warning rather than silent accumulation.
**Warning signs:** Node.js MaxListenersExceededWarning in extension host output.

### Pitfall 5: Signal File Left Behind

**What goes wrong:** The `.steer-agent/last-gate.json` signal file accumulates stale data. On extension restart, the HookBridge reads the old file and emits a stale `hook:signal` event, causing the UI to show an outdated gate result.
**Why it happens:** The file persists across restarts. The HookBridge reads it immediately on startup if it exists.
**How to avoid:** (1) Include a timestamp in the signal file JSON. (2) On startup, only process the signal file if its timestamp is within the last 30 seconds. (3) On extension deactivation, optionally delete the signal file.
**Warning signs:** After restarting Cursor, the panels show a score/status from the previous session.

### Pitfall 6: Hook Exceeds 5-Second Timeout

**What goes wrong:** The hook calls `gate()` (fast, <200ms), but also runs `execSync("git diff --stat")` and `execSync("git diff --name-only")`, reads `criticalModules.json`, and writes the signal file. In a large repo with many changes, git diff can take 1-2 seconds. Total time exceeds Cursor's 5-second hook timeout.
**Why it happens:** `execSync` blocks the main thread. Large diffs with binary files are slow.
**How to avoid:** (1) Set explicit `timeout: 3000` on git execSync calls (already done). (2) If git times out, skip git impact (graceful degradation). (3) Write signal file before returning stdout (so extension gets the result even if Cursor kills the hook). (4) Profile the hook end-to-end under realistic conditions.
**Warning signs:** Cursor shows "Hook timed out" error. Hook never returns output.

## Code Examples

### Example 1: Wiring EventBus in gate() (ARCH-06)

```typescript
// packages/core/src/gate.ts -- modified
import { eventBus } from "./eventBus.js";

export function gate(input: GateInput): GateResult {
  // ... existing scoring, routing, patching logic ...

  const result: GateResult = { /* assembled result */ };

  // Emit event (consumers subscribe independently)
  eventBus.emit("gate:result", result);

  return result;
}
```

### Example 2: Extension Wiring on Activate

```typescript
// packages/cursor-extension/src/extension.ts -- modified
import { eventBus, SessionStore, telemetry } from "@steer-agent-tool/core";
import { MementoPersistence } from "./mementoPersistence.js";
import { HookBridge } from "./hookBridge.js";

export function activate(context: vscode.ExtensionContext) {
  // 1. Create persistence adapter
  const persistence = new MementoPersistence(context.workspaceState);

  // 2. Create SessionStore (wired to EventBus)
  const store = new SessionStore(persistence, eventBus);

  // 3. Start telemetry auto-capture
  const telemetryPath = path.join(context.globalStorageUri.fsPath, "telemetry.jsonl");
  telemetry.subscribeToEventBus(eventBus, telemetryPath);

  // 4. Start hook bridge (watches signal file)
  const bridge = new HookBridge(eventBus);
  context.subscriptions.push(bridge);

  // 5. Subscribe SessionStore to gate:result events
  eventBus.on("gate:result", (result) => {
    store.update({
      lastScore: result.score,
      lastStatus: result.status,
      turnId: result.turnId,
      gateCallCount: store.data.gateCallCount + 1,
      lastModelTier: result.modelSuggestion.tier,
    });
  });

  // ... register panels, commands, etc.
}
```

### Example 3: HookBridge FileSystemWatcher

```typescript
// packages/cursor-extension/src/hookBridge.ts
import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { SIGNAL_DIR, SIGNAL_FILE } from "@steer-agent-tool/core";
import type { SteerEventBus } from "@steer-agent-tool/core";
import type { GateResult } from "@steer-agent-tool/core";

export class HookBridge implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher;
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastProcessedTimestamp: string | null = null;

  constructor(private bus: SteerEventBus) {
    const pattern = new vscode.RelativePattern(
      vscode.workspace.workspaceFolders?.[0] ?? "",
      `${SIGNAL_DIR}/${SIGNAL_FILE}`,
    );
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.watcher.onDidChange(() => this.handleChange());
    this.watcher.onDidCreate(() => this.handleChange());
  }

  private handleChange(): void {
    // Debounce: ignore rapid successive events
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processSignalFile(), 150);
  }

  private async processSignalFile(): Promise<void> {
    try {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) return;
      const filePath = path.join(folder.uri.fsPath, SIGNAL_DIR, SIGNAL_FILE);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content) as GateResult & { _timestamp?: string };

      // Skip stale signals
      if (data._timestamp && data._timestamp === this.lastProcessedTimestamp) return;
      this.lastProcessedTimestamp = data._timestamp ?? null;

      this.bus.emit("hook:signal", { source: "beforeSubmitPrompt", result: data });
    } catch {
      // Signal file may not exist yet or be mid-write
    }
  }

  dispose(): void {
    this.watcher.dispose();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}
```

### Example 4: Hook Signal File Write

```javascript
// hooks/steer-gate-hook.js -- addition after gate() call
const signalDir = path.join(process.cwd(), ".steer-agent");
try {
  if (!fs.existsSync(signalDir)) {
    fs.mkdirSync(signalDir, { recursive: true });
  }
  const signalData = {
    ...gateResult,
    _timestamp: new Date().toISOString(),
    _source: "beforeSubmitPrompt",
  };
  const tmpPath = path.join(signalDir, ".last-gate.tmp");
  const finalPath = path.join(signalDir, "last-gate.json");
  fs.writeFileSync(tmpPath, JSON.stringify(signalData, null, 2));
  fs.renameSync(tmpPath, finalPath);
} catch {
  // Signal file is best-effort; do not fail the hook
}
```

### Example 5: MCP Server Hardening

```typescript
// packages/mcp-server/src/index.ts -- additions at top (before imports)

// Stdout audit: redirect console.log to stderr
const _origLog = console.log;
console.log = (...args: unknown[]) => console.error("[mcp-log]", ...args);

// Global error handlers
process.on("uncaughtException", (err) => {
  console.error("[mcp-fatal] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[mcp-fatal] unhandledRejection:", reason);
});

// Signal handling
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.error(`[mcp] ${sig} received, exiting`);
    process.exit(0);
  });
}

// Keep stdin open (prevent premature exit)
process.stdin.resume();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate gate() implementations per consumer | Canonical gate() in core, thin adapters elsewhere | Already done in v0.2 | Reduces maintenance; all consumers get same scoring logic |
| `vscode.Memento` directly in SessionState | PersistenceAdapter pattern (SessionStore in core) | Phase 1 target | Enables testability, CLI reuse, and decoupling from VS Code |
| Manual telemetry.append() calls | EventBus subscription auto-capture | Phase 1 target | Eliminates forgotten telemetry calls, ensures comprehensive logging |
| Hook stdout-only communication | Hook stdout + signal file + FileSystemWatcher bridge | Phase 1 target | Enables real-time extension updates from hook events |

**Deprecated/outdated:**
- `@vscode/webview-ui-toolkit`: Deprecated Jan 2025. Do not use. Current raw HTML approach is correct for panel complexity level.
- Zod 4: Available but NOT compatible with MCP SDK v1. Stay on Zod 3.x.

## Open Questions

1. **Does Cursor respect `user_message` in hook stdout?**
   - What we know: The hook returns `{ continue: boolean, user_message?: string }`. GitButler's analysis suggests only `continue` is respected. Current hook code returns `user_message`.
   - What's unclear: Whether Cursor versions used by CoinSwitch display `user_message` content.
   - Recommendation: Test empirically on the target Cursor version. If `user_message` is ignored, the signal file bridge becomes the only way to surface gate results. This makes the HookBridge MORE critical, not less.

2. **FileSystemWatcher reliability on different OS platforms**
   - What we know: macOS FSEvents and Linux inotify behave differently. macOS may coalesce events; Linux may fire per-write.
   - What's unclear: Exact behavior with the atomic write (tmp + rename) pattern across platforms.
   - Recommendation: Debounce at 150ms. Include a `_timestamp` field in the signal file for dedup. Test on macOS (CoinSwitch's likely dev platform).

3. **Chat participant API in Cursor**
   - What we know: `vscode.chat.createChatParticipant` is a Copilot-specific API. Forum posts indicate it loads in Cursor but may not appear in chat.
   - What's unclear: Whether current Cursor versions support it.
   - Recommendation: Phase 1 should validate this. If it fails, MCP + command palette + hook bridge are the integration paths. Add graceful degradation: try/catch around chat participant registration, log result.

4. **EventBus singleton behavior in extension + webview**
   - What we know: The EventBus singleton lives in the extension host process. Webviews run in separate iframes and cannot directly access the singleton.
   - What's unclear: Nothing -- this is well understood.
   - Recommendation: Webviews receive updates via `postMessage` from the extension host, which subscribes to EventBus. Webviews do NOT import EventBus directly. This is already the correct pattern in the current codebase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GATE-01 | Canonical gate() function -- single source of truth | ALREADY DONE. `packages/core/src/gate.ts` exists. All consumers use thin adapters. Needs: EventBus emission (ARCH-06). |
| GATE-03 | Transparent scoring breakdown -- per-criterion scores | NEEDS WORK. Current `ScoreResult` has `score`, `missing`, `vagueFlags`, `fileRefs` but no per-criterion breakdown (e.g., clarity: 2/2). Add `criterionScores: Record<string, { score: number; max: number; reason: string }>` to ScoreResult. |
| GATE-06 | nextAction field in GateResult | ALREADY DONE. `deriveNextAction()` in gate.ts returns block/answer_questions/review_and_apply/apply. |
| GATE-07 | GateResult includes all required fields | MOSTLY DONE. Current GateResult has taskId, turnId, status, score, missing, followupQuestions, patchedPrompt, modelSuggestion, costEstimate, gitImpact, nextAction. Missing: model name and provider in modelSuggestion (currently just tier/reason/explanations/cost). |
| GATE-08 | Gate evaluation < 200ms | ALREADY MET. Gate is pure computation (regex + string ops). Benchmark to confirm. |
| ROUT-01 | Explainable model routing with explanations array | ALREADY DONE. `routeModel()` returns `explanations: string[]`. |
| ROUT-02 | Git-aware routing | ALREADY DONE. `routeModel()` checks `gitImpact.criticalFilesHit` and `gitImpact.impactLevel`. |
| ROUT-03 | Cost estimate per prompt | ALREADY DONE. `estimateCost()` calculates based on token count and tier. |
| ROUT-04 | Model suggestion includes tier, model name, provider, cost | PARTIALLY DONE. Has tier, reason, explanations, estimatedCostUsd. Missing: specific model name and provider. Add `modelName: string` and `provider: string` to RouteResult. |
| GIT-01 | Parse git diff --stat and --name-only | ALREADY DONE. `parseGitImpact()` in gitImpact.ts handles both. |
| GIT-02 | Critical module detection with glob patterns | ALREADY DONE. `parseGitImpact()` matches against criticalPaths with simple glob support. |
| GIT-04 | GitImpact in GateResult | ALREADY DONE. Included when gitDiffStat/gitDiffNameOnly are provided. |
| SESS-01 | SessionStateV1 full lifecycle tracking | PARTIALLY DONE. Extension `SessionState` tracks most fields. Need to move to core as `SessionStore`, add `blockedCount`, `overrideCount`. |
| SESS-02 | Session continuity across restarts | PARTIALLY DONE. Extension uses `vscode.Memento`. Need to verify taskId/turn history persist correctly. SessionStore + MementoPersistence adapter solidifies this. |
| SESS-03 | Score trend tracking (last 10) | ALREADY DONE. `SessionState.update()` maintains `scoreTrend` array sliced to last 10. Move to SessionStore in core. |
| ARCH-01 | EventBus in core -- typed pub/sub | NOT DONE. Build `SteerEventBus` class in core with typed EventMap. See Pattern 1 above. |
| ARCH-02 | SessionStore in core with pluggable PersistenceAdapter | NOT DONE. Build `SessionStore` class in core. See Pattern 2 above. Extension creates `MementoPersistence` adapter. |
| ARCH-03 | Hook-to-Extension bridge via signal file + FileSystemWatcher | NOT DONE. Build `HookBridge` in extension, modify hook to write signal file. See Patterns 3 and code examples. |
| ARCH-06 | gate() emits events on EventBus | NOT DONE. Add `eventBus.emit("gate:result", result)` to gate() function. |
| ARCH-07 | All shared types from core | MOSTLY DONE. Types are exported from core. Fix: remove duplicate `GateMode` from extension's SessionState.ts; import from core instead. |
| EXT-05 | Graceful error handling | PARTIALLY DONE. Some try/catch exists. Need: try/catch around chat participant registration, HookBridge error handling, panel rendering guards. |
| HOOK-01 | CJS hook script for beforeSubmitPrompt | ALREADY DONE. `hooks/steer-gate-hook.js` exists, reads stdin, calls gate(), returns stdout JSON. |
| HOOK-02 | Blocking policy based on score | ALREADY DONE. Score <=3 returns continue:false, 4-6 returns continue:true with guidance, >=7 returns continue:true. |
| HOOK-03 | Hook writes signal file | NOT DONE. Add signal file write to steer-gate-hook.js (see Code Example 4). |
| HOOK-04 | Hook completes within 5s | ALREADY MET. Git execSync has 3000ms timeout. Gate is <200ms. Signal file write is <10ms. Total well under 5s. |
| HOOK-05 | Example cursor-hooks.json | ALREADY DONE. `hooks/cursor-hooks.example.json` exists. |
| MCP-01 | steer.gate accepts full GateInput | ALREADY DONE. All GateInput fields are in the Zod schema. |
| MCP-02 | Stateless stdio relay | ALREADY DONE. MCP server calls gate() and returns -- no state. |
| MCP-03 | Stdout audit, error handlers, signal handling | NOT DONE. Add console.log redirect, uncaughtException handler, SIGINT/SIGTERM handlers. See Code Example 5. |
| MCP-04 | Smoke test script | ALREADY DONE. `packages/mcp-server/src/smoke.mjs` tests all 4 cases with assertions. |
| TELE-01 | JSONL append telemetry | ALREADY DONE. `telemetry.ts` appends JSON lines. |
| TELE-02 | Telemetry path uses context.globalStorageUri | NOT DONE. Current default is `./data/telemetry.jsonl` (relative). Extension must pass absolute path from `context.globalStorageUri.fsPath`. |
| TELE-03 | Telemetry subscribes to EventBus | NOT DONE. Add `subscribeToEventBus()` function. See Pattern 5 above. |
| CONF-03 | criticalModules.json integration | ALREADY DONE. `criticalModules.json` exists at project root. Hook reads it. Gate accepts `criticalPaths` input. |
| REL-01 | MCP stays alive on errors | NOT DONE. Add uncaughtException/unhandledRejection handlers. See MCP hardening pattern. |
| REL-02 | Extension degrades gracefully | PARTIALLY DONE. Need try/catch around chat participant, HookBridge, and gate calls in extension. |
| REL-03 | Validate Cursor chat participant compatibility | NOT DONE. Must test @steer participant in Cursor. If it fails, document MCP as primary path. Add graceful detection. |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- **Existing codebase** -- Read all source files in packages/core, packages/mcp-server, packages/cli, packages/cursor-extension, and hooks/
- **Node.js EventEmitter documentation** -- `node:events` module, standard API
- **VS Code Extension API** -- `vscode.workspace.createFileSystemWatcher`, `vscode.Memento`, webview lifecycle
- **MCP Specification** -- stdio transport, JSON-RPC framing, error handling

### Secondary (MEDIUM confidence)
- **.planning/research/ARCHITECTURE.md** -- Prior research on architecture patterns, EventBus design, hook limitations
- **.planning/research/PITFALLS.md** -- Prior research on 13 pitfalls with mitigation strategies
- **.planning/research/STACK.md** -- Prior research on technology stack decisions and alternatives
- **GitButler Cursor Hooks Deep Dive** -- Hook stdin/stdout format, behavioral details
- **Cursor Forum** -- Chat participant API compatibility in Cursor

### Tertiary (LOW confidence)
- **Cursor `user_message` support** -- Whether Cursor displays user_message from hook stdout is unverified. Must test empirically.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies needed; all libraries already in use
- Architecture: HIGH -- patterns are standard (EventEmitter, adapter, file-based IPC); prior research validates approach
- Pitfalls: HIGH -- identified from existing research, codebase analysis, and known MCP/VS Code patterns

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days -- stack is stable, no fast-moving dependencies)
