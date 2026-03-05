# SteerAgent — Team Setup (Confluence)

> Copy this page into Confluence under Engineering > Developer Tools > SteerAgent.
> Replace `[ARTIFACTORY_URL]` and team-specific details before publishing.

---

## What is SteerAgent?

SteerAgent wraps every Claude Code session in a **governed 8-step workflow** — structured prompts, automatic context gathering, governance rules, and a compounding knowledge base.

**For developers:** Less time fiddling with prompts. More consistent, reviewable AI output.
**For leads:** Visibility into what Claude is doing. Guardrails that don't require trust.

---

## 5-Minute Setup

### Prerequisites

- Node.js >= 18 installed (`node -v`)
- Access to CoinSwitch Artifactory npm registry
- Claude Code installed

### One-time machine setup

```bash
# 1. Configure the registry
npm config set @coinswitch:registry https://artifactory.coinswitch.co/npm/

# 2. Install the package
npm install -g @coinswitch/steer-agent

# 3. Register MCP server, skills, and hooks
steer-agent install
```

### Per-project setup

```bash
cd ~/bitbucketRepo/your-project-name
steer-agent init --template coinswitch

# Commit the .steer/ folder (shared with team)
git add .steer/
git commit -m "chore: add SteerAgent workflow governance"
git push
```

Once committed, **teammates who pull the repo get the rules and templates automatically.** They only need to run `steer-agent install` once on their own machine.

### Verify

```bash
steer-agent status
```

All items should show ✅. If not, run `steer-agent doctor` to auto-fix.

---

## Daily Usage (in Claude Code)

Open Claude Code in your project and start with a slash command:

| What you want | Command |
|---|---|
| Start any task | `/steer-start <description>` |
| Resume a task | `/steer-resume` |
| Check task progress | `/steer-status` |
| Generate a commit message | `/steer-commit` |
| Generate a PR description | `/steer-pr` |
| Search past knowledge | `/steer-knowledge <query>` |

**Examples:**

```
/steer-start Fix the null pointer crash in auth/TokenService — COIN-4521
/steer-start Add rate limiting to the OTP endpoint
/steer-start Refactor UserRepository to use the new CacheService
```

---

## What the Governance Rules Enforce

Rules live in `.steer/RULES.md` in your project (committed, customisable).

Default CoinSwitch preset:

| Rule | Severity | What it does |
|---|---|---|
| Scope Restriction | BLOCK | Claude cannot touch files outside the declared scope |
| Critical Module Guard | BLOCK | `auth/` and `payments/` changes require explicit approval |
| Test Coverage | WARN | Functions longer than 20 lines need tests |
| Repository Pattern | BLOCK | No direct database queries |
| PR Size Limit | WARN | Warning at 250 LOC, limit at 300 LOC |
| Lint Before Commit | AUTO | Runs eslint + prettier automatically |
| No Direct Redis | BLOCK | All cache access must go through CacheService |

**BLOCK** = Claude stops and asks. **WARN** = Claude proceeds with a note. **AUTO** = silently enforced.

Team leads can add project-specific rules by editing `.steer/RULES.md`.

---

## The Knowledge Base

After every completed task, SteerAgent extracts learnings into `.steer/knowledge/`. This is committed to git.

Over time your team accumulates:
- Which approaches work (and which don't) in your codebase
- Patterns specific to your architecture
- Module-specific gotchas

New team members instantly inherit everything the team has learned.

---

## Maintenance

```bash
steer-agent status      # Check health
steer-agent doctor      # Auto-fix any issues
steer-agent update      # Update to latest version
```

---

## Troubleshooting

**Skills not showing in Claude Code**
```bash
steer-agent install --force
```

**MCP server not connecting**
```bash
steer-agent doctor   # auto-fixes registration issues
```

**`.steer/` not found in a project**
```bash
steer-agent init --template coinswitch
```

For anything else: ping `#dev-tools` on Slack or file an issue in the `steer-agent` Bitbucket repo.

---

## For Team Leads

### Adding a new project

```bash
cd ~/bitbucketRepo/<project>
steer-agent init --template coinswitch --team <team-name>
# Edit .steer/config.json to add critical modules for this project
git add .steer/ && git commit -m "chore: add SteerAgent"
```

### Customising rules

Edit `.steer/RULES.md` in your project repo. Rules follow this format:

```markdown
## R7 — No console.log in production [BLOCK]
Never leave console.log statements in non-test files.
```

Commit and push — all team members get the updated rules on next pull.

### Viewing FPCR

```bash
cat .steer/state/history.jsonl | grep '"fpcr"'
```

Or use `/steer-status` in Claude Code for a summary.

---

## Questions?

- Slack: `#dev-tools`
- Repo: `bitbucket.org/coinswitch/steer-agent`
- Issues: file in Bitbucket
