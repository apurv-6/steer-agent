# Project Research Summary

**Project:** SteerAgent (Prompt Gating Tool)
**Domain:** AI prompt gating / developer productivity tooling (VS Code/Cursor extension + MCP server)
**Researched:** 2026-02-24
**Confidence:** HIGH (stack), MEDIUM (features, architecture, pitfalls)

## Executive Summary

SteerAgent occupies a genuinely unique market position: no existing AI coding tool (Cursor, Continue.dev, Aider) performs pre-submission prompt quality gating. The v0.2 codebase has the right structural foundation — scoring engine, prompt patching, model routing, Cursor extension, MCP server — but the components are disconnected from each other at runtime. Each consumer (hook, extension, CLI, MCP) calls `gate()` independently with no shared session state or cross-component event propagation. The v1 architecture work is fundamentally about making these disconnected pieces feel like one coherent product, primarily by introducing a typed EventBus and SessionStore in core.

The recommended approach is to ship a hardened v1 to the 14-dev CoinSwitch pilot as fast as possible, using the pilot data to validate scoring assumptions before investing in differentiator features. The critical technical work for v1 is: fix the hook-to-extension communication gap (file-based IPC bridge), harden MCP server reliability (stdout audit, error handlers), resolve the Cursor chat participant incompatibility (the `@steer` participant may silently fail in Cursor — make MCP the primary integration path), and expose the scoring breakdown (per-criterion scores are computed but not surfaced). Project-scoped configuration (`.steer/config.json`) is the single most important feature addition because it unblocks configurable thresholds, custom sections, and budget guardrails.

The dominant risk is not technical — it is adoption. The METR study (2025) confirms AI tools already slow experienced developers by 19% when tasks require careful judgment. Adding a mandatory prompt gate on top of that will cause immediate bypass if the perceived friction exceeds the perceived value on every interaction. The mitigation is a graduated friction model: start the pilot in suggest-only mode, surface concrete value ("your score improved from 4.2 to 7.1"), and let developers opt into blocking mode. Every feature decision should be evaluated against the question: does this feel like a helpful pair programmer or a bureaucratic checkpoint?

## Key Findings

### Recommended Stack

The existing stack is well-chosen and requires only targeted upgrades. TypeScript 5.9, MCP SDK 1.27, vitest 4, and @vscode/vsce 3 are the meaningful version bumps. The critical constraint is Zod 3.x — do not upgrade to Zod 4 until MCP SDK v2 ships, as the MCP tool registration API requires Zod 3 schemas. For webviews, the current raw HTML approach is correct for the v1 sidebar panels; `@vscode/webview-ui-toolkit` was deprecated in January 2025 and must not be used. See [STACK.md](.planning/research/STACK.md) for full version table.

**Core technologies:**
- TypeScript 5.9: all packages — import defer improves extension startup; upgrade is non-breaking
- @modelcontextprotocol/sdk 1.27: MCP server — adds Streamable HTTP transport; keep stdio for v1, HTTP for v2 shared server
- Zod 3.24 (frozen): schema validation — MCP SDK requires Zod 3; do NOT go to Zod 4
- esbuild 0.27 (direct): extension bundling — VS Code officially recommends esbuild for CJS extension output
- tsup 8.5: library bundling (core, mcp-server, cli) — zero-config dual ESM+CJS+dts; revisit for v2 as maintainer suggests tsdown successor
- vitest 4: unit/integration tests — ESM-native, fast; migration steps needed from v3
- cursor-hooks 1.1.5 (new): hook types — provides TypeScript types for BeforeSubmitPromptPayload instead of hand-rolling
- JSONL file append (built-in): telemetry — correct for 14-dev pilot; do not add OpenTelemetry or SQLite at this scale

### Expected Features

SteerAgent's v0.2 already has the core engine. The gap between v0.2 and a credible v1.0 is small but important: transparency (expose scoring internals), configurability (per-project config), and reliability (error handling + session persistence). The differentiator features (score trend visualization, prompt templates, learning mode coaching) should be deferred until pilot data confirms what actually drives adoption. See [FEATURES.md](.planning/research/FEATURES.md) for full prioritization matrix.

**Must have (table stakes for v1.0):**
- Transparent scoring breakdown — expose per-criterion scores (goal: 2/2, limits: 0/2) in GateResult; data is already computed, just not surfaced
- Project-scoped configuration (.steer/config.json) — required thresholds, section weights, critical path patterns; unlocks most other config features
- Configurable score thresholds — replace hardcoded BLOCKED/NEEDS_INFO/READY values; part of project config
- Error handling polish — try/catch in extension, graceful MCP failures, user-facing error notifications
- Session continuity — persist taskId and turn history across restarts; only reset on explicit "New Task"

**Should have (v1.x after pilot validation):**
- Custom section definitions — when teams need THREAT_MODEL, SCHEMA, etc. instead of GOAL/LIMITS/REVIEW
- Score trend visualization — when telemetry has enough data to show patterns (scoreTrend array exists but is unused)
- Prompt template library — 5-10 built-in templates per mode; triggered when teams ask "what do I put in GOAL?"
- Learning mode / coaching tips — before/after prompt examples based on detected gaps
- MCP multi-editor testing (Claude Desktop, Windsurf, Cline) — triggered when non-Cursor users request support

**Defer (v2+):**
- Cost-aware budget guardrails — requires cost tracking infrastructure; justify at team scale
- Team prompt patterns dashboard — requires aggregation pipeline and web UI; justify at 10+ devs
- Automatic context injection (AST-based) — requires file access and token budgeting; defer until core loop is validated

**Anti-features (deliberately not building):**
- LLM-based prompt scoring — adds 500ms-2s latency, cost per call, non-determinism; heuristic scoring is instant, free, debuggable
- Blocking prompts by default — developers will disable the tool; default to advisory mode, opt-in to blocking
- Full prompt rewriting — developers lose ownership; patch sections only, suggest improvements as annotations

### Architecture Approach

The core architectural gap is the lack of a shared communication layer between components. The recommended pattern is an EventBus + SessionStore in `@steer-agent-tool/core` that all consumers subscribe to. The `gate()` function becomes event-emitting; telemetry subscribes to the bus automatically rather than requiring manual logging calls. The hook-to-extension communication gap is solved via file-based IPC: the hook writes a signal file (`~/.steer-agent/last-gate.json`), and the extension watches it with `vscode.workspace.createFileSystemWatcher`. This is the only viable IPC approach given the hook's 5-second timeout and separate process lifecycle. See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for full component diagram and data flow.

**Major components:**
1. **core/EventBus** — typed pub/sub (Node.js EventEmitter + TypeScript discriminated union); decouples producers from consumers; zero VS Code dependencies
2. **core/SessionStore** — in-memory session state with pluggable PersistenceAdapter; extension injects vscode.Memento adapter, CLI uses ephemeral; tracks score trend, task lifecycle
3. **Extension HookBridge** — FileSystemWatcher on signal file; translates hook events into EventBus events; the critical missing link between hook and extension
4. **CommandRouter** — single dispatch point for all VS Code command registrations; replaces scattered `registerCommand` calls in `activate()`
5. **Typed webview message protocol** — discriminated union for ToWebviewMessage / FromWebviewMessage; replaces current untyped `msg.type` switch
6. **MCP Server** — stateless stdio relay to `gate()`; no EventBus integration (separate process); primary integration path for Cursor

### Critical Pitfalls

The full analysis of 13 pitfalls is in [PITFALLS.md](.planning/research/PITFALLS.md). The five that could kill the project:

1. **Developer bypass (adoption failure)** — If gate friction exceeds perceived value on every interaction, developers disable the tool permanently. Prevention: graduated friction model (suggest-only for week 1), show before/after diff highlighting, fast-pass for developers scoring consistently 7+, surface concrete wins in telemetry.

2. **Scoring system feels arbitrary or gameable** — Pure regex structural scoring means `## GOAL\nfix it` scores 9/10 while a detailed natural-language prompt without headers scores 4/10. Prevention: add semantic validation layer (content within sections, not just presence of headers); build "gaming" test cases; expose per-criterion breakdown so developers can dispute specific deductions.

3. **Cursor chat participant API incompatibility** — `vscode.chat.createChatParticipant` is a VS Code Copilot-specific API that silently fails in Cursor. The `@steer` chat participant may activate without errors but never appear in Cursor's chat window. Prevention: validate on day 1 against the exact Cursor version CoinSwitch uses; make MCP the primary integration path, not the chat participant; degrade gracefully with prominent alternative paths.

4. **MCP stdio transport silent death** — Unhandled exceptions or stray `console.log` to stdout corrupts JSON-RPC and kills the connection silently. Prevention: audit all code paths for stdout writes, add global error handlers (`process.on('uncaughtException')`), signal handling (SIGINT/SIGTERM), `process.stdin.resume()` keepalive, run `smoke.mjs` as part of install verification.

5. **Telemetry path breaks in extension context** — Relative path `./data/telemetry.jsonl` writes to an unpredictable location in the VS Code extension context. Prevention: use `context.globalStorageUri` for extension telemetry; use explicit absolute path from config for MCP server. Telemetry is how pilot success is measured — silent failures mean flying blind.

## Implications for Roadmap

Based on combined research, the architecture's dependency layers and the pilot's adoption risk profile suggest the following phase structure:

### Phase 1: Pilot-Ready Hardening

**Rationale:** The three most critical blockers for the CoinSwitch pilot are: (a) the Cursor chat participant may silently fail, (b) the MCP server dies silently on errors, and (c) telemetry writes to the wrong path. None of these are feature work — they are reliability and correctness work that must be resolved before any developer uses the tool. Architecture refactoring (EventBus, SessionStore) also belongs here because the hook-to-extension bridge is currently broken and the panels display stale or disconnected data.

**Delivers:** A production-reliable tool that 14 developers can actually install and use without silent failures. Hook fires, extension panel updates, telemetry writes, MCP server stays alive.

**Addresses features from FEATURES.md:**
- Error handling polish (P1)
- Session continuity (P1)
- Transparent scoring breakdown (P1) — expose internals before coaching features

**Architecture work:**
- core/EventBus + core/SessionStore (Phase 1a/1b in architecture build order)
- Hook signal file write + Extension HookBridge (Phase 2a/2b)
- MCP server reliability: stdout audit, error handlers, signal handling, smoke test
- Telemetry path fix: use `context.globalStorageUri`

**Avoids pitfalls:**
- Pitfall 3 (Cursor chat participant): validate day 1, make MCP primary path
- Pitfall 5 (MCP silent death): error handlers + smoke test
- Pitfall 6 (telemetry path): absolute paths via VS Code storage API
- Pitfall 12 (monorepo build): CI pipeline, documented build order

**Research flag:** Does not need `/gsd:research-phase` — patterns are well-established (Node EventEmitter, VS Code FileSystemWatcher, MCP stdio spec).

### Phase 2: Configuration and Scoring Credibility

**Rationale:** Project-scoped configuration is the single highest-leverage feature because it unblocks configurable thresholds, custom sections, and budget guardrails — all of which depend on it. Scoring credibility must be addressed before the pilot generates feedback ("the score doesn't mean anything") that kills confidence. These two concerns reinforce each other: configurable weights require the config system, and the config system's value is demonstrated through configurable scoring.

**Delivers:** Teams can tune the tool for their codebase. The score is credible and transparent enough to trust. The extension refactor (typed messages, CommandRouter, panel subscriptions via EventBus) is completed so the UI is reliable.

**Addresses features from FEATURES.md:**
- Project-scoped configuration (P1): `.steer/config.json` with thresholds, section weights, critical paths
- Configurable score thresholds (P1): replace hardcoded BLOCKED/NEEDS_INFO/READY values
- Custom section definitions (P2): teams define THREAT_MODEL, SCHEMA, etc.

**Architecture work:**
- Extension refactor: typed webview message protocol, CommandRouter, panels subscribe to EventBus (Phase 3a/3b/3c)
- Config loader integrated with scorePrompt — data-driven weights replacing hardcoded deductions
- Scoring upgrade: semantic content validation within sections, mode-specific scoring profiles

**Avoids pitfalls:**
- Pitfall 2 (arbitrary scoring): semantic validation + gaming test cases
- Pitfall 4 (webview state desync): message-based updates + webview getState/setState
- Pitfall 7 (fragmented UX): designate MCP as primary surface, panels as read-only dashboards
- Pitfall 8 (hardcoded weights): make configurable via project config

**Research flag:** Custom section definitions may need `/gsd:research-phase` — the conflict with hardcoded scoring assumptions requires careful refactoring of the scorer to be data-driven.

### Phase 3: Pilot Feedback Features

**Rationale:** After weeks 1-2 of pilot data, specific adoption patterns will be clear: Are developers gaming the score? Do they plateau at a certain score? Are they asking "what should I put in GOAL?" The features in this phase are triggered by pilot observations, not by assumption. Score trend visualization, prompt templates, and learning mode coaching are all high-value but only if the pilot reveals the problems they solve.

**Delivers:** Features that directly address the adoption patterns observed in the pilot. This phase is deliberately data-driven — scope is set by what telemetry shows, not by the pre-pilot roadmap.

**Addresses features from FEATURES.md:**
- Score trend visualization (P2): sparkline in StatusPanel, metrics CLI command, uses existing scoreTrend array
- Prompt template library (P2): 5-10 built-in templates per mode, custom templates in `.steer/templates/`
- Learning mode / coaching (P2): before/after examples, contextual tips in follow-up questions
- MCP multi-editor testing (P2): Claude Desktop, Windsurf, Cline configs

**Avoids pitfalls:**
- Pitfall 1 (bypass): concrete value surfacing ("your average score improved from 4.2 to 7.1")
- Pitfall 13 (wizard over-engineering): max 3 questions, smart defaults, allow skipping
- Pitfall 10 (security): webview CSP headers, MCP input length limits

**Research flag:** Likely needs `/gsd:research-phase` for MCP multi-editor testing — Cursor's MCP support details differ from the VS Code MCP spec and each client (Claude Desktop, Windsurf) has its own configuration format.

### Phase 4: Scale Preparation

**Rationale:** The v2+ features (budget guardrails, team dashboard, context injection) require infrastructure that does not yet exist: cost tracking, telemetry aggregation pipeline, AST parsing. These cannot be added incrementally to v1 — they require dedicated architecture work. Phase 4 is explicitly about preparing for scale: telemetry schema must be extensible now to avoid migration later, and the MCP embedded server option (VS Code 1.102+) reduces a configuration step for VS Code users.

**Delivers:** Architecture ready for 100+ developer scale. Telemetry schema locked for aggregation consumers. Cost-aware routing foundation.

**Addresses features from FEATURES.md:**
- Cost-aware budget guardrails (P3): daily/weekly spend caps, tier auto-downgrade on budget exceeded
- Team prompt patterns dashboard (P3): aggregation over JSONL, CLI reporter or web dashboard
- Embedded MCP server (future): `contributes.mcpServerDefinitionProviders` in package.json eliminates manual stdio config

**Avoids pitfalls:**
- Pitfall 11 (stale cost estimates): externalize pricing to `pricing.json` with staleness warnings
- Pitfall 9 (hooks API instability): hooks for observation only; fallback to MCP/command palette

**Research flag:** Needs `/gsd:research-phase` for budget guardrails — cost tracking per user/team requires telemetry schema design and potentially a backend aggregation service; scope depends on CoinSwitch's infrastructure constraints.

### Phase Ordering Rationale

- Phase 1 must precede everything: pilot cannot start without reliable foundations; Cursor compatibility and MCP reliability are go/no-go criteria
- Phase 2 ordering is driven by feature dependencies: config system is the prerequisite for all configurable features; scoring credibility is prerequisite for adoption trust
- Phase 3 is explicitly post-pilot: scope is determined by telemetry, not assumption; shipping features developers do not need is the wrong move for an internal tool
- Phase 4 is deferred until team scale justifies infrastructure: at 14 devs, JSONL + regex is sufficient; at 100 devs, the aggregation pipeline and cost tracking have ROI

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (custom sections):** Refactoring scorePrompt.ts to be data-driven requires careful API design; the conflict between configurable sections and hardcoded scoring assumptions is non-trivial
- **Phase 3 (MCP multi-editor):** Each MCP client (Claude Desktop, Windsurf, Cline, Copilot) has different configuration formats and capability levels; compatibility matrix needs dedicated research
- **Phase 4 (budget guardrails):** Cost tracking per user/team requires telemetry schema design and potentially aggregation backend; CoinSwitch infrastructure constraints are unknown

Phases with standard patterns (skip research-phase):
- **Phase 1 (core infrastructure):** EventBus (Node EventEmitter + TypeScript), SessionStore (adapter pattern), FileSystemWatcher IPC — all are well-documented, established patterns with high-confidence sources
- **Phase 1 (MCP reliability):** stdout audit + process error handlers + signal handling — standard Node.js patterns, fully documented in MCP spec
- **Phase 2 (extension refactor):** Typed webview message protocol, CommandRouter — standard VS Code extension patterns with official documentation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All major recommendations verified against official docs (VS Code, MCP spec, npm). Zod/MCP SDK compatibility constraint is the only critical non-obvious finding. |
| Features | MEDIUM | Competitive analysis based on public docs; no direct user research. The "no competitor does prompt gating" claim is based on web research as of Feb 2026 — the landscape moves fast. METR productivity study is HIGH confidence; individual feature priority judgments are inferred. |
| Architecture | MEDIUM-HIGH | Core patterns (EventBus, SessionStore, adapter) are HIGH confidence standard patterns. File-based IPC for hook-to-extension is MEDIUM — race condition risk noted, atomic rename mitigation recommended. Cursor chat participant incompatibility is MEDIUM — community reports confirm it but Cursor updates frequently. |
| Pitfalls | HIGH | Adoption failure pattern (developers bypassing gates) is well-documented across all friction-adding developer tools. MCP stdio silent death and webview state desync are HIGH confidence — both have documented bug reports and official mitigation guidance. Cursor hooks API instability is MEDIUM. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Cursor chat participant support in current version:** Must be empirically verified against the exact Cursor version CoinSwitch uses before Phase 1 is marked complete. Do not rely on forum reports from potentially outdated Cursor versions.
- **MCP SDK v2 timeline:** Expected Q1 2026 per research, but not confirmed. Phase 4 planning should include a spike to evaluate v2 migration scope when it ships.
- **Scoring calibration data:** The heuristic scoring weights (GOAL: -2, LIMITS: -2, etc.) are assumptions. Phase 2 must include calibration against real pilot prompt data to validate weights reflect actual quality signals.
- **CoinSwitch infrastructure constraints:** Budget guardrails (Phase 4) require understanding whether CoinSwitch has a centralized observability backend or is purely local-file telemetry. This affects Phase 4 scope significantly.
- **`user_message` field in Cursor hook response:** Current hook code returns `user_message` in the `beforeSubmitPrompt` response, but research suggests Cursor may only respect the `continue` field. Must be tested empirically; the UX for blocked prompts depends on this.

## Sources

### Primary (HIGH confidence)
- [VS Code Extension API](https://code.visualstudio.com/api) — webview API, chat participants, FileSystemWatcher, MCP embedding
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) — version compatibility, transport options
- [MCP Transports Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — stdio transport behavior and limitations
- [Cursor Hooks Documentation](https://cursor.com/docs/agent/hooks) — beforeSubmitPrompt hook schema and constraints
- [METR Study on AI Developer Productivity](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) — 19% slowdown finding; adoption friction risk
- [Claude Code Webview Blank After Auto-Update (Issue #13130)](https://github.com/anthropics/claude-code/issues/13130) — webview state desync documented
- [Trail of Bits: VS Code Extension Security](https://blog.trailofbits.com/2023/02/21/vscode-extension-escape-vulnerability/) — webview XSS risk

### Secondary (MEDIUM confidence)
- [GitButler Cursor Hooks Deep Dive](https://blog.gitbutler.com/cursor-hooks-deep-dive) — hook behavior, `user_message` field uncertainty
- [Cursor Forum: VS Code Chat Participant Extensions in Cursor](https://forum.cursor.com/t/vscode-copilot-chat-extension-for-cursor/59115) — chat participant incompatibility
- [Augment Code: Rebuilding State Management for 2x Performance](https://www.augmentcode.com/blog/rebuilding-state-management) — webview state management patterns
- [MCP Error -32000 Guide (MCPcat)](https://mcpcat.io/guides/fixing-mcp-error-32000-connection-closed/) — stdio transport failure modes
- [VS Code Messenger (TypeFox)](https://www.typefox.io/blog/vs-code-messenger/) — typed webview message protocol
- [Continue.dev Documentation](https://docs.continue.dev/) — competitor feature analysis
- [Aider GitHub](https://github.com/Aider-AI/aider) — competitor feature analysis
- [Cursor Rules Documentation](https://cursor.com/docs/context/rules) — competitor feature analysis
- [InfoQ: Cursor 1.7 Hooks](https://www.infoq.com/news/2025/10/cursor-hooks/) — hooks API stability assessment

### Tertiary (LOW confidence)
- [AI Coding Productivity Statistics (Panto)](https://www.getpanto.ai/blog/ai-coding-productivity-statistics) — aggregated statistics, needs primary source validation
- [Cursor Analytics for Teams (Workweave)](https://workweave.dev/blog/cursor-analytics-tracking-ai-coding-tool-usage-for-engineering-teams) — team analytics single-source

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
