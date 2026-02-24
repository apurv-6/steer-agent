# Feature Research

**Domain:** AI prompt gating / developer productivity tooling
**Researched:** 2026-02-24
**Confidence:** MEDIUM

## Current State (v0.2)

SteerAgent already has: section-based scoring (GOAL/LIMITS/REVIEW), follow-up questions (max 3), 5-section prompt patching, tier-based model routing (small/mid/high), JSONL telemetry, Cursor extension (StatusPanel + WizardPanel + @steer chat participant), MCP server, CLI. This research focuses on what is missing vs. what the ecosystem expects.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or abandoned quickly.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Transparent scoring breakdown** | Cursor rules, Continue.dev, and Aider all show users WHY something scored the way it did. Current scoring is opaque -- users see "6/10" but not weighted contributions. Developers distrust black boxes. | LOW | Add per-criterion score breakdown to ScoreResult (e.g., goal: 2/2, limits: 0/2, vagueness: -1). Already have the data internally, just not exposing it. |
| **Project-scoped configuration** | Cursor rules (.cursor/rules/*.mdc), Continue.dev (.continue/config.yaml), Aider (.aider.conf.yml) all support per-project config. Every AI dev tool has this. Teams need different scoring weights, critical paths, and section requirements per repo. | MEDIUM | Config file in repo root (e.g., .steer/config.json) that defines: required sections, custom section weights, critical file patterns, mode definitions, score thresholds per status. |
| **Configurable score thresholds** | Current BLOCKED/NEEDS_INFO/READY thresholds are hardcoded. Teams have different quality bars -- an infra team may require score 8+, a prototyping team may accept 5+. Every linting/gating tool allows threshold config. | LOW | Part of project-scoped config. Define thresholds as { blocked: 4, needsInfo: 7 } or similar. |
| **Custom section definitions** | Current tool hardcodes GOAL/LIMITS/REVIEW. Different teams need different prompt structures. A security team may require THREAT_MODEL; a data team may require SCHEMA. Cursor rules and Continue config both allow arbitrary structure. | MEDIUM | Extend scoring config to accept arbitrary required sections with weights. Keep GOAL/LIMITS/REVIEW as sensible defaults. |
| **Copy/paste prompt without extension** | Not every developer uses Cursor. The CLI `steer` command exists but the patched prompt output needs to be easily pasteable into any LLM interface. Aider works purely in terminal. | LOW | Already partially exists via CLI. Ensure clean output format with copy-friendly boundaries. |
| **Error/edge-case handling in extension** | Current extension crashes silently on errors (e.g., if core throws). Users expect graceful degradation, error messages, and retry options. This is basic UX polish. | LOW | Try/catch wrappers, user-facing error notifications, retry buttons. |
| **Session continuity across restarts** | Current session state uses workspaceState but resets taskId on activate. Users expect that closing and reopening Cursor preserves their in-progress task context. | LOW | Persist taskId and turn history in workspaceState, only reset on explicit "New Task" action. |

### Differentiators (Competitive Advantage)

Features that set SteerAgent apart. These are NOT standard in the ecosystem -- they represent the unique value proposition of prompt gating.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Context-aware scoring (git diff integration)** | No competitor does pre-submission prompt gating that considers git context. Cursor hooks are informational-only (cannot inject context). SteerAgent already parses git diff -- the differentiator is using diff scope to flag when prompts are under-specified relative to what changed. E.g., "touching auth.ts but no LIMITS section mentioning auth" = warning. | MEDIUM | Enhance scoring to cross-reference fileRefs and git changedFiles against prompt content. Add "context gap" detection: files in scope but not mentioned in prompt. |
| **Score trend visualization** | Show developers how their prompt quality improves over time. No AI coding tool tracks prompt quality longitudinally. This creates a feedback loop that actually teaches better prompting habits. Existing scoreTrend array in SessionState is unused. | MEDIUM | Sparkline or mini-chart in StatusPanel showing score history per session. Aggregate trends in metrics CLI command. Weekly/monthly reports from telemetry data. |
| **Cost-aware model routing with budget guardrails** | Copilot's "Auto" mode routes for availability, not cost-awareness. SteerAgent already routes by tier -- adding budget awareness (daily/weekly spend caps, per-prompt cost warnings) is unique. Enterprise teams at CoinSwitch care about LLM spend. | HIGH | Requires: cost tracking per user/team (build on telemetry), budget config per project, warning when approaching limits, automatic tier downgrade when budget exceeded. |
| **Prompt template library** | Pre-built prompt templates for common tasks (refactor, debug, review, migration). No IDE tool offers a curated template library that works with a gating system. Templates = guaranteed high scores + faster workflows. | MEDIUM | Ship 5-10 built-in templates mapped to modes. Allow teams to define custom templates in .steer/templates/. Template selection in Wizard panel dropdown. Templates produce pre-structured prompts that score 8+. |
| **Learning mode / prompt coaching** | Instead of just scoring, explain WHY a section matters and show examples. "Your GOAL is vague because it uses 'fix' without specifying the expected behavior. Better: 'Make the login API return 401 instead of 500 when credentials are invalid.'" Turns gating from friction into education. | MEDIUM | Enhance follow-up questions with contextual tips. Add "Learn more" links in Wizard panel. Generate before/after prompt examples based on the specific gaps detected. |
| **MCP-native integration for non-Cursor editors** | The MCP server already exists. The differentiator is making it work seamlessly with Claude Desktop, Windsurf, Cline, and other MCP clients. This makes SteerAgent editor-agnostic while competitors are editor-locked. | LOW | Already have MCP server. Needs documentation, tested configs for each client, and possibly additional MCP tools (e.g., steer.templates, steer.history). |
| **Team prompt patterns dashboard** | Aggregate telemetry to show team-level patterns: common missing sections, average scores by mode, most-overridden blocks, cost per developer. Cursor has basic usage analytics but nothing prompt-quality focused. | HIGH | Build on JSONL telemetry. Requires: aggregation pipeline, web dashboard or CLI reporter, team-level config. Deferred to later phase but architecturally prepare telemetry schema now. |
| **Automatic context injection from codebase** | When a prompt references files, automatically inject relevant type signatures, function signatures, or recent git blame. This is what Augment Code and Continue.dev do at the model level -- SteerAgent can do it at the prompt patching level, making the patched prompt self-contained. | HIGH | Requires file system access, AST parsing or signature extraction, token budget management. High value but high complexity -- defer to v2+. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Deliberately NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **LLM-based prompt scoring** | "Use AI to evaluate AI prompts" sounds smart and could catch nuanced quality issues. | Adds latency (500ms-2s per gate call), costs money per evaluation, creates dependency on LLM availability, makes scoring non-deterministic (same prompt gets different scores), and creates circular dependency (need good prompts to evaluate prompts). The current regex/heuristic approach is instant, free, deterministic, and debuggable. | Keep heuristic scoring. Add more heuristic rules (detect code blocks without explanation, detect single-line prompts, detect copy-pasted error messages without context). Reserve LLM scoring for optional "deep analysis" mode only. |
| **Blocking prompts by default** | "Force developers to write good prompts." Enterprise governance teams love mandatory gates. | Developers will disable the tool instantly. The METR study (2025) showed AI tools already make experienced devs 19% slower -- adding mandatory friction on top will cause revolt. Cursor's own hooks cannot block prompts for this reason. | Default to advisory mode (NEEDS_INFO shows warnings, never prevents submission). Allow teams to opt-in to blocking mode via config. Override always available with reason (already implemented). |
| **Real-time scoring as you type** | "Score the prompt as the developer types, like a spell checker." | Creates constant distraction, wastes computation on incomplete thoughts, and the Wizard panel would flicker constantly. Developers compose prompts in bursts -- scoring mid-thought interrupts flow. | Score on explicit submission only (current behavior). Optionally add a "Check" button for manual pre-evaluation. |
| **Full prompt rewriting** | "Don't just patch sections -- rewrite the entire prompt for optimal quality." | Developers lose ownership of their prompts. They won't trust or understand rewritten prompts. Patching preserves intent while adding structure; rewriting changes intent. | Keep current section-based patching. Add "suggest improvements" as inline annotations rather than rewrites. |
| **Multi-LLM provider management** | "Let SteerAgent manage API keys and route to different LLM providers." | Scope creep into API gateway territory. Tools like LiteLLM, OpenRouter, and Cursor itself already handle provider management. SteerAgent should recommend tiers, not manage connections. | Recommend tier (small/mid/high) and let the IDE or user handle provider selection. Add model name suggestions per tier in config (e.g., { small: "haiku", mid: "sonnet", high: "opus" }) but don't manage API keys. |
| **Approval workflows** | "Require manager approval before high-cost prompts are sent." | Kills developer velocity. Async approval creates context-switching hell. Nobody wants to wait for approval on a coding prompt. | Use budget guardrails instead (automatic tier downgrade when budget exceeded). Log overrides for post-hoc review rather than pre-hoc approval. |

## Feature Dependencies

```
[Project-scoped config]
    |--- enables ---> [Configurable thresholds]
    |--- enables ---> [Custom section definitions]
    |--- enables ---> [Team prompt patterns dashboard]
    |--- enables ---> [Budget guardrails config]

[Transparent scoring breakdown]
    |--- enables ---> [Score trend visualization]
    |--- enables ---> [Learning mode / prompt coaching]

[Git diff integration (exists)]
    |--- enhances --> [Context-aware scoring]

[Telemetry (exists)]
    |--- enables ---> [Score trend visualization]
    |--- enables ---> [Team prompt patterns dashboard]
    |--- enables ---> [Cost-aware budget guardrails]

[Prompt template library]
    |--- independent, no dependencies

[MCP server (exists)]
    |--- enhances --> [MCP-native multi-editor support]

[Custom section definitions] --- conflicts --- [Hardcoded section assumptions in scorePrompt.ts]
```

### Dependency Notes

- **Project-scoped config enables most differentiators:** Without per-project config, thresholds, custom sections, and budget guardrails have nowhere to live. Build config first.
- **Transparent scoring enables learning features:** Cannot coach developers on prompt quality without showing them the scoring breakdown. Expose internals before building education features.
- **Telemetry enables analytics:** The JSONL append is already there. Score trend and team dashboard both read from telemetry. Ensure telemetry schema is extensible before building consumers.
- **Custom sections conflict with hardcoded scoring:** Current scorePrompt.ts hardcodes GOAL/LIMITS/REVIEW checks. Making sections configurable requires refactoring the scorer to be data-driven.

## MVP Definition

### Launch With (v1.0) -- What's needed beyond current v0.2

- [x] Section-based scoring (exists)
- [x] Follow-up questions (exists)
- [x] Prompt patching (exists)
- [x] Model routing (exists)
- [x] Extension with panels (exists)
- [x] MCP server (exists)
- [ ] **Transparent scoring breakdown** -- expose per-criterion scores in GateResult
- [ ] **Project-scoped configuration** -- .steer/config.json with thresholds, sections, critical paths
- [ ] **Configurable score thresholds** -- part of config, replace hardcoded values
- [ ] **Error handling polish** -- graceful failures in extension and MCP
- [ ] **Session continuity** -- persist task across restarts

### Add After Validation (v1.x)

- [ ] **Custom section definitions** -- triggered when teams request non-standard prompt structures
- [ ] **Score trend visualization** -- triggered when telemetry has enough data to show patterns
- [ ] **Prompt template library** -- triggered when teams report "what should I put in GOAL?"
- [ ] **Learning mode / coaching tips** -- triggered when adoption data shows users plateau at same score
- [ ] **MCP multi-editor testing** -- triggered when non-Cursor users request support

### Future Consideration (v2+)

- [ ] **Cost-aware budget guardrails** -- requires cost tracking infrastructure, defer until team scale justifies
- [ ] **Team prompt patterns dashboard** -- requires aggregation pipeline, web UI, defer until 10+ developers using tool
- [ ] **Automatic context injection** -- requires AST parsing, file access, token budgeting, defer until core loop is validated

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Transparent scoring breakdown | HIGH | LOW | P1 |
| Project-scoped configuration | HIGH | MEDIUM | P1 |
| Configurable score thresholds | HIGH | LOW | P1 |
| Error handling polish | MEDIUM | LOW | P1 |
| Session continuity | MEDIUM | LOW | P1 |
| Custom section definitions | HIGH | MEDIUM | P2 |
| Score trend visualization | MEDIUM | MEDIUM | P2 |
| Prompt template library | HIGH | MEDIUM | P2 |
| Learning mode / coaching | MEDIUM | MEDIUM | P2 |
| MCP multi-editor support | MEDIUM | LOW | P2 |
| Cost-aware budget guardrails | HIGH | HIGH | P3 |
| Team patterns dashboard | MEDIUM | HIGH | P3 |
| Automatic context injection | HIGH | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.0 launch (foundational, low-cost, high-trust)
- P2: Should have for v1.x (differentiation, add when core is proven)
- P3: Nice to have for v2+ (infrastructure-heavy, scale-dependent)

## Competitor Feature Analysis

| Feature | Cursor | Continue.dev | Aider | SteerAgent (current) | SteerAgent (planned) |
|---------|--------|--------------|-------|---------------------|---------------------|
| Prompt quality scoring | None | None | None | Section-based 0-10 | Per-criterion breakdown |
| Prompt improvement | Rules inject context | Config-based system prompts | /architect mode for planning | Follow-ups + patching | Templates + coaching |
| Model routing | Auto (availability-based) | Manual model selection | Manual model selection | Tier-based (task+score+git) | Budget-aware routing |
| Git-aware context | Implicit (reads workspace) | Implicit | Auto-commits, repo map | Parses git diff stat | Context gap detection |
| Cost visibility | Multiplier on hover | None | None | Estimated cost per prompt | Budget guardrails |
| Telemetry/analytics | Team admin dashboard | None | None | JSONL append | Score trends + team dashboard |
| Project config | .cursor/rules/*.mdc | .continue/config.yaml | .aider.conf.yml | None | .steer/config.json |
| Multi-editor | Cursor only | VS Code + JetBrains | Terminal (any editor) | Cursor extension + MCP | MCP for any MCP client |
| Prompt templates | Community .cursorrules | Config presets | Chat modes (/architect, /ask) | None | Built-in + custom templates |
| Hook integration | 6 lifecycle hooks | N/A | N/A | Uses beforeSubmitPrompt concept | MCP tool callable from any hook |

### Key Competitive Insight

No existing tool in the market does prompt gating -- scoring prompts before they reach the LLM and helping developers improve them. Cursor rules and Continue configs shape AI behavior (system prompts), Aider manages the coding workflow, but none evaluate the quality of what the developer is asking. SteerAgent occupies a unique position: it is the quality gate between developer intent and LLM execution. The risk is not competition -- it is adoption friction. The tool must feel like a helpful pair programmer, not a bureaucratic checkpoint.

## Sources

- [Cursor Rules Documentation](https://cursor.com/docs/context/rules) -- MEDIUM confidence (web search verified with official docs)
- [Cursor Hooks Documentation](https://cursor.com/docs/agent/hooks) -- MEDIUM confidence (web search, multiple sources agree)
- [Continue.dev Documentation](https://docs.continue.dev/) -- MEDIUM confidence (web search verified)
- [Aider GitHub](https://github.com/Aider-AI/aider) -- MEDIUM confidence (web search verified)
- [Cursor Analytics for Teams](https://workweave.dev/blog/cursor-analytics-tracking-ai-coding-tool-usage-for-engineering-teams) -- LOW confidence (single source)
- [METR Study on AI Developer Productivity](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) -- HIGH confidence (peer-reviewed study)
- [AI Coding Productivity Statistics](https://www.getpanto.ai/blog/ai-coding-productivity-statistics) -- LOW confidence (aggregator)
- [Cursor Changelog - v2.5 Plugins](https://cursor.com/changelog) -- MEDIUM confidence (official source)
- [GitButler Deep Dive on Cursor Hooks](https://blog.gitbutler.com/cursor-hooks-deep-dive) -- MEDIUM confidence (technical blog, verified against official docs)

---
*Feature research for: AI prompt gating / developer productivity tooling*
*Researched: 2026-02-24*
