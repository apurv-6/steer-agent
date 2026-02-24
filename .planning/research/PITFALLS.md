# Domain Pitfalls

**Domain:** AI prompt gating / developer productivity tooling (VS Code extension + MCP server)
**Project:** SteerAgent v0.2 -> v1 for CoinSwitch (14-dev pilot)
**Researched:** 2026-02-24

---

## Critical Pitfalls

Mistakes that cause rewrites, adoption failure, or project abandonment.

---

### Pitfall 1: The Gate Becomes the Enemy (Developer Bypass)

**What goes wrong:** Developers find the prompt gate annoying and disable it permanently. The tool goes from "installed on 14 machines" to "enabled on 0." Every friction-adding developer tool faces this: if the perceived cost of using it exceeds the perceived benefit on *every single interaction*, developers will route around it. This is the single highest risk for SteerAgent.

**Why it happens:** The gate blocks or slows down prompts that the developer *already thinks are good enough*. A developer in flow state hits BLOCKED on a prompt they believe is clear, and the tool becomes an obstacle rather than an assistant. The current `blockThreshold` of 3 means even moderately vague prompts get through, but NEEDS_INFO still adds friction. If follow-up questions feel pedantic or irrelevant, trust erodes fast.

**Consequences:** Zero adoption = zero value. CoinSwitch pilot fails. The tool becomes "that thing we installed once." Management loses confidence in the approach.

**Prevention:**
1. **Never block without immediate visible value.** When the gate says NEEDS_INFO, the follow-up questions must feel genuinely helpful, not bureaucratic. Each question should clearly connect to "your AI response will be better because of this."
2. **Show the "before/after" immediately.** The patched prompt should visibly demonstrate why the gate's suggestions improve the output. Current implementation shows the patched prompt but does not show what changed -- add diff highlighting.
3. **Graduated friction model.** Start with "suggest" mode (zero blocking, just suggestions) for the first week. Let developers see value before imposing any gates. Add soft blocks after trust is established.
4. **Fast-pass for repeat patterns.** If a developer's prompts consistently score 7+, reduce the gate to a quick badge rather than a full panel interaction.
5. **Measure and surface wins.** Show "You saved ~$X this week" or "Your prompt scores improved from avg 4.2 to 7.1" -- make the value concrete.

**Detection:**
- Monitor `steerEnabled: false` rates in telemetry. If >30% of users disable within week 1, this pitfall has triggered.
- Track override rates. High override-to-apply ratios mean the gate is adding friction without value.
- Watch for users who stop using `@steer` entirely and just paste prompts directly.

**Phase relevance:** Must be addressed in Phase 1 (MVP/pilot). Cannot defer. The pilot IS the adoption test.

**Confidence:** HIGH -- this is a well-documented pattern for any developer tool that adds process friction (linters, formatters, code review bots all face this).

---

### Pitfall 2: Scoring System Feels Arbitrary or Gameable

**What goes wrong:** Developers learn that adding `## GOAL`, `## LIMITS`, `## REVIEW` headers to any prompt automatically gives them a high score, regardless of content quality. Or conversely, genuinely good prompts score low because they do not use the expected format. The scoring system loses credibility and becomes something to game rather than a quality signal.

**Why it happens:** The current `scorePrompt` implementation is purely structural -- it checks for section headers and vague verbs via regex. It does not evaluate semantic quality at all. A prompt with `## GOAL\nfix it\n## LIMITS\nnone\n## REVIEW\nyes` scores 9/10 while a detailed, well-structured natural language prompt without headers scores 4/10. Research on automated prompt evaluation consistently shows that surface-pattern metrics diverge from actual quality.

**Consequences:** Developers stop trusting the score. "It gave me a 9 and the AI still produced garbage" destroys confidence. The score becomes theater -- developers add boilerplate headers to satisfy the gate, but prompt quality does not actually improve. The entire value proposition collapses.

**Prevention:**
1. **Semantic scoring layer.** Use a small/fast LLM (or even a local model) to evaluate whether the GOAL section actually contains a goal, not just a header. This is the single most impactful technical improvement.
2. **Negative examples in scoring tests.** Build a test suite of "gaming" prompts (headers with empty/useless content) and ensure they score low.
3. **Calibrate against outcomes.** Once telemetry captures prompt-score-to-outcome data, use it to validate and adjust scoring weights. If score-8 prompts produce bad results as often as score-5 prompts, the scoring is broken.
4. **Transparent scoring breakdown.** Show *why* each point was deducted/added. Current implementation returns `missing` array and `vagueFlags` -- surface these prominently so developers understand and can dispute specific deductions.
5. **Mode-specific scoring.** A `debug` mode prompt has different quality signals than a `design` mode prompt. Current scoring is mode-agnostic.

**Detection:**
- Score distribution clustering: if >80% of prompts score 8+ after a week, developers are gaming it.
- Bimodal distribution (lots of 3s and lots of 9s, nothing in between) suggests the scoring has gaps.
- User feedback: "the score doesn't mean anything" is a direct signal.

**Phase relevance:** V1 must ship with at least basic semantic validation. Pure regex scoring is acceptable for v0.2 pilot, but must be upgraded before broader rollout.

**Confidence:** HIGH -- the current `scorePrompt.ts` implementation is purely structural, and research on automated evaluation confirms surface-pattern metrics diverge from human judgment.

---

### Pitfall 3: Cursor Chat Participant API Incompatibility

**What goes wrong:** The `vscode.chat.createChatParticipant` API used in `extension.ts` is a VS Code Copilot-specific API. Cursor is a VS Code fork but has its own chat system. Chat participant extensions loaded in Cursor cannot be accessed from the Cursor chat window. The entire `@steer` chat integration -- which is the primary UX surface -- silently fails in Cursor.

**Why it happens:** Cursor forks VS Code but does not implement all proposed/copilot-specific APIs. The chat participant API was designed for GitHub Copilot integration. Cursor has its own agent/chat architecture. Forum posts confirm that chat participant extensions "load" in Cursor but are not accessible from the chat window. The extension activates without errors but the `@steer` participant never appears.

**Consequences:** The primary interaction model (type `@steer` in chat) does not work in the target IDE. CoinSwitch developers using Cursor (likely the majority for an AI-focused team) cannot use the tool's main feature. Only the command palette (`steeragent.suggest`) and webview panels work.

**Prevention:**
1. **Test in Cursor first, not VS Code.** Make Cursor the primary development target since that is what CoinSwitch developers use.
2. **Design MCP-first architecture.** The MCP server (`steer.gate` tool) works in any MCP-compatible client, including Cursor's native MCP support. Make this the primary integration path, not the chat participant.
3. **Use Cursor Hooks as the interception point.** Cursor 1.7+ hooks can intercept agent lifecycle events. This is a more stable integration point than the chat participant API.
4. **Degrade gracefully.** Detect at activation whether the chat participant API is available. If not, prominently surface the alternative paths (MCP, command palette, webview).
5. **Abstract the chat integration.** Build a provider interface so the chat integration can be swapped between VS Code chat participant, Cursor hooks, or MCP without changing core logic.

**Detection:**
- Extension activates in Cursor without errors but `@steer` never appears in chat completions.
- Telemetry shows zero chat participant invocations from Cursor users.
- Developers report "I installed it but can't find @steer."

**Phase relevance:** MUST be validated in Phase 1, before pilot begins. If the primary UX does not work in the target IDE, the pilot is dead on arrival.

**Confidence:** MEDIUM-HIGH -- forum posts confirm the incompatibility, but Cursor updates frequently and may have added/changed chat participant support. Must be verified against the exact Cursor version CoinSwitch uses.

---

### Pitfall 4: Webview State Desync and Zombie Panels

**What goes wrong:** The WizardPanel and StatusPanel webviews get out of sync with actual extension state. The webview shows stale data (old score, wrong mode, previous task's follow-up questions) while the extension has moved on. Worse: after Cursor/VS Code auto-updates, webview resource references break and panels go blank.

**Why it happens:** Several interacting issues in the current architecture:
1. **Full HTML re-render on every state change.** The `render()` method in both panels generates complete HTML strings and sets `webview.html`. This destroys and recreates the entire DOM, losing any in-progress form input (a developer typing answers to follow-up questions loses their work when state updates).
2. **No `retainContextWhenHidden`.** When the panel is not visible, the webview is destroyed. Switching to another tab and back loses all state. The current implementation uses `state.onDidChange` to re-render, but the webview might not exist when the event fires.
3. **Extension update breaks resource paths.** VS Code extensions load from versioned directories. Auto-update installs a new version in a new directory. Active webviews retain references to the old directory's resources.

**Consequences:** Developers see blank panels, stale data, or lose their in-progress answers. This is not a crash -- it is a slow erosion of trust. "The panel was showing the wrong score" or "I typed my answers and they disappeared" makes the tool feel unreliable.

**Prevention:**
1. **Use `getState`/`setState` in webview scripts.** The VS Code API provides webview-side state persistence that survives hide/show cycles with lower overhead than `retainContextWhenHidden`. Store form input state in the webview's own state.
2. **Message-based updates, not full re-renders.** Instead of replacing `webview.html` on every change, post messages to the webview and update the DOM incrementally. This preserves form state and is more performant.
3. **Guard against missing `_view`.** Add null checks before posting messages. The current code already checks `if (!this._view) return` in `render()`, but should also guard in `updateGateResult`.
4. **Handle the extension update scenario.** Use `webview.onDidDispose` to clean up, and consider a "reconnect" mechanism where the webview detects stale resources and requests a refresh.
5. **Use `vscode-messenger` or similar library** for structured webview communication with automatic lifecycle management.

**Detection:**
- Users report "the panel is blank" or "it shows the wrong information."
- Telemetry shows `gateCallCount` incrementing but webview never receives the update.
- After auto-update, panels show white/error screens.

**Phase relevance:** Phase 2 (UX polish). The current approach works for a 14-person pilot where manual refresh is acceptable. Must be fixed before broader rollout.

**Confidence:** HIGH -- this is a documented VS Code webview pattern. The Augment Code blog post describes rebuilding state management for exactly these reasons, achieving 2x performance improvement. The Claude Code GitHub issue (#13130) documents the exact auto-update blank screen problem.

---

### Pitfall 5: MCP Stdio Transport Silent Death

**What goes wrong:** The MCP server process crashes or hangs silently. The client (Cursor, Claude Desktop) shows no error -- tools just stop working. The developer does not realize the MCP server died until they try to use `steer.gate` and nothing happens. Or worse: the server process stays alive but stdin/stdout get corrupted, producing garbled JSON-RPC responses.

**Why it happens:** Stdio transport has no built-in health check or keepalive mechanism. If the server process throws an unhandled exception, writes non-JSON-RPC content to stdout (e.g., a stray `console.log`), or the Node.js event loop drains, the connection dies silently. The current implementation has no error handling around the server startup (`startServer` is async void with no catch), no signal handling, and no stderr logging strategy.

**Consequences:** Developers think "the tool is broken" and disable it. Support burden increases. Trust erodes. In a 14-person pilot, even one person experiencing silent failures poisons the well ("don't bother, it doesn't work half the time").

**Prevention:**
1. **Never write to stdout except JSON-RPC.** Audit all code paths for `console.log` -- redirect everything to stderr. Add a lint rule or wrapper.
2. **Global error handlers.** Add `process.on('uncaughtException')` and `process.on('unhandledRejection')` that log to stderr and attempt graceful shutdown.
3. **Signal handling.** Handle SIGINT and SIGTERM for clean shutdown.
4. **Startup validation.** The `startServer` function should catch connection errors and log meaningful diagnostics to stderr.
5. **Keep-alive.** Add `process.stdin.resume()` to prevent premature exit.
6. **Smoke test on install.** The existing `smoke.mjs` is a good start -- make it part of the setup verification so users confirm the MCP server works before relying on it.

**Detection:**
- Telemetry gap: extension shows gate calls but MCP shows zero invocations.
- Process monitoring: `steer-agent-tool` process disappears from process list.
- Users report "steer.gate tool not found" in their MCP client.

**Phase relevance:** Phase 1 (MVP). MCP reliability is table-stakes for the pilot.

**Confidence:** HIGH -- MCP stdio transport failure is the most commonly reported MCP issue. The MCPcat guide on error -32000 and multiple forum posts document this pattern extensively.

---

## Moderate Pitfalls

---

### Pitfall 6: Telemetry Path Breaks in Extension Context

**What goes wrong:** The telemetry module writes to `./data/telemetry.jsonl` using a relative path. In the VS Code extension context, the working directory is unpredictable -- it could be the workspace root, the extension directory, or the user's home directory. The telemetry file ends up in unexpected locations or fails silently when the directory does not exist.

**Prevention:**
1. Use `context.globalStorageUri` or `context.storageUri` for extension telemetry paths -- these are guaranteed writable locations managed by VS Code.
2. For the MCP server, use an explicit absolute path from configuration, not a relative path.
3. The current `mkdir(dirname(filePath), { recursive: true })` is good but insufficient when the base path itself is wrong.

**Phase relevance:** Phase 1. Telemetry is how you measure pilot success. If it silently fails, you are flying blind.

**Confidence:** HIGH -- relative path issue is visible in `telemetry.ts` line 3.

---

### Pitfall 7: Fragmented UX Across Three Surfaces

**What goes wrong:** The tool has three interaction surfaces: chat participant (`@steer`), command palette (`steeragent.suggest`), and webview panels (StatusPanel + WizardPanel). Each surface shows different information, has different interaction patterns, and operates at different levels of completeness. Developers do not know which surface to use, or start on one and have to switch to another mid-flow.

**Prevention:**
1. **Designate one primary surface.** For the pilot, this should be the MCP tool (works in Cursor natively) or the chat participant (if in VS Code). The webview should be a dashboard, not a required interaction step.
2. **Eliminate surface-hopping.** The current flow is: type `@steer` in chat -> see results in chat -> answer follow-ups in Wizard panel -> click Apply. This crosses two surfaces. The entire flow should complete in one surface.
3. **The webview panels should be read-only dashboards.** Status and trends, not interactive workflows. Move all interaction to the chat/MCP surface.

**Phase relevance:** Phase 2 (UX consolidation). Acceptable for 14-person pilot with documentation. Must be fixed before broader rollout.

**Confidence:** HIGH -- observable in current codebase. The `extension.ts` chat participant directs users to "Answer in Wizard panel" (line 86-88), forcing a surface switch.

---

### Pitfall 8: Hardcoded Scoring Weights Are Not Calibratable

**What goes wrong:** The scoring deductions are hardcoded: missing GOAL = -2, missing LIMITS = -2, missing REVIEW = -2, vague verbs = -1, unscoped file refs = -1. These weights cannot be adjusted per-team, per-mode, or based on observed outcomes. CoinSwitch's actual prompt patterns might not match these assumptions at all.

**Prevention:**
1. Make scoring weights configurable via a `.steerrc` or VS Code settings. Allow teams to adjust what matters.
2. Add mode-specific weight profiles. A `bugfix` mode should weight reproduction steps higher; `design` mode should weight GOAL/LIMITS higher.
3. Plan for data-driven weight adjustment. After collecting pilot telemetry, analyze which scoring factors actually correlate with better AI outputs.

**Phase relevance:** Phase 2. Hardcoded weights are fine for initial pilot, but must be configurable before team-wide rollout.

**Confidence:** HIGH -- observable in `scorePrompt.ts`.

---

### Pitfall 9: Cursor Hooks API Instability

**What goes wrong:** If the roadmap plans to use Cursor Hooks (introduced v1.7, October 2025) for deeper integration (intercepting agent actions, running the gate before every prompt), the hooks API is beta and has changed between Cursor versions. Building deep integration on an unstable API means breakage on every Cursor update.

**Prevention:**
1. **Use hooks for observation only, not control flow.** Hooks for logging/telemetry are low-risk. Hooks that block or modify agent behavior are high-risk if the API changes.
2. **Version-pin and test.** Pin the minimum Cursor version in `package.json` engines. Test against Cursor beta channel before each release.
3. **Fallback gracefully.** If hooks are unavailable (older Cursor version, or API removed), the tool should still work via MCP/command palette.
4. **Monitor Cursor changelog.** Subscribe to Cursor release notes. The API has already evolved from 1.7 to 2.3.

**Phase relevance:** Phase 3+ (deeper integration). Do not depend on hooks for the pilot.

**Confidence:** MEDIUM -- Cursor hooks are documented as beta. The API surface is small but coverage and stability are explicitly called out as evolving.

---

### Pitfall 10: Security -- Webview XSS and MCP Tool Poisoning

**What goes wrong:** The WizardPanel renders user-provided prompt content inside webview HTML. While the current `esc()` function handles basic HTML entities, a sophisticated injection through prompt content could exploit the webview. On the MCP side, tool descriptions could be manipulated by malicious MCP servers in multi-server environments.

**Prevention:**
1. **Set Content Security Policy on webviews.** The current implementation does not set CSP headers. Add strict CSP that prevents inline scripts beyond the known script block.
2. **Validate all message types.** The `onDidReceiveMessage` handler should reject unknown message types.
3. **MCP server should validate inputs.** The Zod schemas in the MCP server are good, but add length limits and content sanitization.
4. **Scope MCP server permissions.** The tool should only read/write to designated telemetry/config paths, not arbitrary filesystem locations.

**Phase relevance:** Phase 2 for webview CSP (before broader rollout). Phase 1 for MCP input validation (before pilot).

**Confidence:** MEDIUM-HIGH -- the Trail of Bits VS Code security research and the timeline of MCP security breaches document these as real attack vectors, not theoretical.

---

## Minor Pitfalls

---

### Pitfall 11: Cost Estimation Becomes Stale

**What goes wrong:** The model routing and cost estimation in `routeModel.ts` uses hardcoded token costs. LLM pricing changes frequently (sometimes monthly). The cost estimates shown to developers become inaccurate, undermining the "save money" value proposition.

**Prevention:** Store pricing as configuration, not code constants. Add a `pricing.json` that can be updated independently. Include a "last updated" date and warn when pricing data is older than 30 days.

**Phase relevance:** Phase 2. Acceptable approximation for pilot.

**Confidence:** HIGH -- LLM pricing volatility is well-documented.

---

### Pitfall 12: Monorepo Build Complexity

**What goes wrong:** The monorepo has four packages (core, cli, mcp-server, cursor-extension) with different build tools (tsup for core/mcp, esbuild for extension). Dependency version drift, build order issues, and "works on my machine" problems multiply with contributors.

**Prevention:**
1. Use workspace protocol (`workspace:*`) for internal dependencies (already done).
2. Add a CI pipeline that builds all packages in dependency order.
3. Pin exact versions for critical dependencies (MCP SDK, VS Code types).
4. Document the build order: core -> cli/mcp-server/extension.

**Phase relevance:** Phase 1. Must be solid before 14 developers start contributing or even installing.

**Confidence:** HIGH -- standard monorepo challenge, observable in current `package.json` files.

---

### Pitfall 13: Over-Engineering the Follow-Up Question System

**What goes wrong:** The follow-up question system becomes a complex wizard with branching logic, conditional questions, and multi-step flows. Developers feel like they are filling out a form instead of writing a prompt. The wizard becomes the bottleneck that causes Pitfall 1 (bypass).

**Prevention:**
1. Maximum 3 follow-up questions per gate call.
2. Questions should be answerable in under 10 seconds each.
3. Provide smart defaults. If the question is "What is the scope?" pre-fill with the file references already detected.
4. Allow skipping questions. Partial answers should still improve the score.

**Phase relevance:** Phase 1 (design constraint for pilot).

**Confidence:** MEDIUM -- design guidance, not technical finding.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Phase 1: MVP/Pilot Setup | Chat participant does not work in Cursor (#3) | Validate Cursor compatibility on day 1. Have MCP fallback ready. |
| Phase 1: MVP/Pilot Setup | MCP server silent crashes (#5) | Add error handlers, signal handling, stdout audit before pilot. |
| Phase 1: MVP/Pilot Setup | Telemetry writes to wrong path (#6) | Use absolute/configurable paths. Verify telemetry works in extension context. |
| Phase 1: MVP/Pilot Setup | Developers disable the gate (#1) | Start in suggest-only mode. Show value before imposing friction. |
| Phase 2: Scoring & UX | Scores feel arbitrary (#2) | Add semantic scoring. Build "gaming" test cases. |
| Phase 2: Scoring & UX | Fragmented UX (#7) | Consolidate to single primary surface. Make panels read-only dashboards. |
| Phase 2: Scoring & UX | Webview state desync (#4) | Switch to message-based updates. Use webview getState/setState. |
| Phase 2: Scoring & UX | Hardcoded weights (#8) | Make configurable. Add mode-specific profiles. |
| Phase 3: Deep Integration | Cursor hooks instability (#9) | Use for observation only. Fallback gracefully. Version-pin. |
| Phase 3: Deep Integration | Security issues (#10) | Add CSP to webviews. Validate MCP inputs. Scope permissions. |
| Ongoing | Cost estimation staleness (#11) | Externalize pricing to config. Add staleness warnings. |
| Ongoing | Monorepo build complexity (#12) | CI pipeline. Documented build order. Pinned versions. |

---

## Adoption-Specific Warnings (CoinSwitch 14-Dev Pilot)

These are not technical pitfalls but organizational ones that commonly kill internal tool adoption.

### The Champion Problem
If one person championed SteerAgent and they go on vacation or leave, adoption stalls. **Mitigation:** Get at least 3 people to be "Steer champions" who understand the value proposition and can help teammates.

### The "Works for Me" Problem
The tool works well for the developer who built it because they naturally write prompts in the expected format. Other developers with different prompting styles get low scores and feel punished. **Mitigation:** Pilot with diverse prompting styles. Adjust scoring based on real usage patterns, not the author's patterns.

### The Metrics Misuse Problem
Management sees prompt scores and starts using them as developer performance metrics ("Why are your prompts always scoring 4?"). This creates fear and resistance. **Mitigation:** Make scores visible only to the individual developer. Aggregate team metrics only. Never expose individual score distributions to management.

### The "Another Tool" Problem
CoinSwitch developers already use multiple tools. Adding another one that requires learning new commands, new panels, and new workflows competes for cognitive bandwidth. **Mitigation:** The tool should feel like a natural part of the existing workflow, not a separate workflow. Prefer passive integration (MCP tool that Cursor calls automatically) over active integration (developer must remember to invoke `@steer`).

---

## Sources

- [VS Code Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview) -- HIGH confidence, official docs
- [VS Code Chat Participant API](https://code.visualstudio.com/api/extension-guides/ai/chat) -- HIGH confidence, official docs
- [Augment Code: Rebuilding State Management for 2x Performance](https://www.augmentcode.com/blog/rebuilding-state-management) -- MEDIUM confidence, real-world case study
- [Claude Code Webview Blank After Auto-Update (Issue #13130)](https://github.com/anthropics/claude-code/issues/13130) -- HIGH confidence, documented bug
- [Cursor Forum: VS Code Chat Participant Extensions in Cursor](https://forum.cursor.com/t/vscode-copilot-chat-extension-for-cursor/59115) -- MEDIUM confidence, community report
- [Cursor 1.7 Hooks - InfoQ](https://www.infoq.com/news/2025/10/cursor-hooks/) -- MEDIUM confidence, tech journalism
- [MCP Error -32000: Connection Closed Guide](https://mcpcat.io/guides/fixing-mcp-error-32000-connection-closed/) -- MEDIUM confidence, community guide
- [MCP Error Handling Best Practices](https://mcpcat.io/guides/error-handling-custom-mcp-servers/) -- MEDIUM confidence, community guide
- [MCP Stdio Transport Specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) -- HIGH confidence, official spec
- [Trail of Bits: VS Code Extension Security](https://blog.trailofbits.com/2023/02/21/vscode-extension-escape-vulnerability/) -- HIGH confidence, security research
- [Timeline of MCP Security Breaches](https://authzed.com/blog/timeline-mcp-breaches) -- MEDIUM confidence, security reporting
- [Salesforce: AI Tooling Boosted Code Output 30%](https://engineering.salesforce.com/how-ai-enabled-tooling-boosted-code-output-30-while-keeping-quality-and-deployment-safety-intact/) -- MEDIUM confidence, case study
- [TypeFox: VS Code Messenger for Webview Communication](https://www.typefox.io/blog/vs-code-messenger/) -- MEDIUM confidence, library documentation
- [Prompt Engineering Evaluation: Supercharge.io](https://supercharge.io/us/blog/ai-prompt-engineering-best-practices) -- LOW confidence, blog post
