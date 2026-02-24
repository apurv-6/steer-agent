# SteerAgent Daily Workflow

## The Loop

```
prompt → gate → fix → patched prompt → run → telemetry
```

Every prompt goes through this loop. SteerAgent enforces structure so LLMs get better instructions and you waste fewer tokens.

## How a Developer Uses It

### Path A: Automatic (Hook)

With `~/.cursor/hooks.json` configured:

1. Type your prompt normally in Cursor chat
2. On submit, the hook runs `steer.gate` automatically
3. **If BLOCKED (score ≤ 3):** prompt is rejected. You see what's missing and what to add.
4. **If NEEDS_INFO (score 4-6):** prompt goes through, but you see a message with follow-up suggestions.
5. **If READY (score ≥ 7):** prompt goes through with a brief score/model/cost summary.

### Path B: Manual (@steer)

1. In Cursor chat, type: `@steer fix the login bug in auth module`
2. See inline results: status, score, missing sections, follow-ups, patched prompt
3. Click **"Apply to Chat"** to use the patched prompt
4. Open the Wizard panel (sidebar) to answer follow-ups and re-evaluate

### Path C: Command Palette

1. `Cmd+Shift+P` → "Steer Agent: Suggest"
2. Enter your prompt in the input box
3. Results appear in the Wizard panel
4. Answer follow-ups → click Re-evaluate → click Apply

### Path D: CLI

```bash
steer-agent-tool steer
```

Interactive mode: pick mode → enter prompt → answer follow-ups → get patched prompt.

## What "Gate Calls" Means

**Gate calls** = the number of times `steer.gate` was invoked during the current session (task). This includes:
- Initial evaluation
- Re-evaluations after answering follow-ups
- Hook invocations

A higher gate call count means more iteration, which usually means better prompt quality. The score trend shows improvement across gate calls.

## Status Levels

| Status | Score | What Happens |
|--------|-------|-------------|
| **BLOCKED** | ≤ 3 | Hard gate. Prompt rejected. Must add structure. |
| **NEEDS_INFO** | 4-6 | Soft gate. Prompt allowed but guidance shown. Follow-ups offered. |
| **READY** | ≥ 7 | Prompt is well-structured. Go. |

## Scoring Rules

Prompts start at 10/10. Points deducted for:
- Missing `## GOAL` section: **-2**
- Missing `## LIMITS` section: **-2**
- Missing `## REVIEW` / `## VERIFICATION` section: **-2**
- Vague verbs (fix, improve, help, check): **-1**
- `@file` references without scope definition: **-1**

## Model Routing

The router recommends a model tier based on:

| Rule | Trigger | Tier |
|------|---------|------|
| Critical files | `git diff` hits paths in `criticalModules.json` | **high** |
| Design/plan mode | Score ≥ 7 in design or plan mode | **high** |
| Large diff | 20+ files or 500+ lines changed | **mid** |
| Review mode | Code review task | **mid** |
| Bugfix/debug | Score ≥ 7 in bugfix/debug | **mid** |
| Low quality | Score ≤ 4 (even if critical) | Downgraded to **mid** |
| Default | Everything else | **small** |

Every routing decision includes an `explanations` array with reasons.

## Cost Estimates

Rough blended cost per 1K tokens:
- **small**: $0.0003 (haiku / gpt-4o-mini)
- **mid**: $0.003 (sonnet / gpt-4o)
- **high**: $0.015 (opus / o1)

## Telemetry

Events logged to `./data/telemetry.jsonl` on each "Apply to Chat":
- `taskId`, `turnId`, `gateCallCount`
- `finalScore`, `scoreTrend`
- `modelTier`, `overrideUsed`, `mode`

View with: `steer-agent-tool metrics`
