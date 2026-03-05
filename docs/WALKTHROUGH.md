# SteerAgent — 15-Minute Team Walkthrough

Facilitator guide for the mobile-eng onboarding session.

**Format:** Screen-share + live demo
**Time:** 15 minutes
**Goal:** Every developer leaves with SteerAgent working and understands the daily flow

---

## Before the Session (facilitator prep)

- [ ] Publish `@coinswitch/steer-agent` to Artifactory
- [ ] Share the Confluence setup page link in Slack before the call
- [ ] Have a real project repo open in Claude Code (cs-india-react-mobile-v2)
- [ ] Run `steer-agent status` — confirm all ✅ before the call

---

## Minute 0–2: Why

> "We've all experienced AI coding sessions that go sideways — 6 iterations to get something usable, Claude editing files it shouldn't, no record of what worked. SteerAgent fixes that."

Show the before/after table from the README (or just say it):

| Without | With |
|---|---|
| Vague prompt → 5-7 iterations | Structured prompt → 1-2 iterations |
| Claude touches everything | Scope restriction blocks it |
| Knowledge lost after task | Knowledge committed to git |
| No measurement | FPCR tracks improvement |

> "It's 2 commands to set up and then it's just slash commands in Claude Code."

---

## Minute 2–6: Install (everyone does this live)

Share screen and walk through this — everyone follows along:

```bash
# Registry (if not already configured):
npm config set @coinswitch:registry https://artifactory.coinswitch.co/npm/

# Install:
npm install -g @coinswitch/steer-agent

# Register:
steer-agent install
```

> "This registers the MCP server, installs 16 skill commands, and sets up a prompt hook — all in one command."

Then:

```bash
steer-agent status
```

> "Everything should be green. If not, run `steer-agent doctor` and it'll fix it."

**Pause — make sure everyone has status showing ✅ before continuing.**

---

## Minute 6–9: Project init (demo only)

Switch to `cs-india-react-mobile-v2`:

```bash
cd ~/bitbucketRepo/cs-india-react-mobile-v2
steer-agent init --template coinswitch
```

Show what was created:

```bash
cat .steer/RULES.md
```

> "These are the governance rules. BLOCK means Claude stops and asks you. WARN means it proceeds but flags it. You can edit this file — it's just markdown, committed to git. Every team member gets the same rules."

> "The coinswitch template pre-configures auth and payments as critical modules — Claude needs explicit approval to touch those."

Show the templates briefly:

```bash
ls .steer/templates/
```

> "There's a prompt template for each mode — bugfix, feature, refactor, debug, review. SteerAgent fills these in automatically from your task description and codebase context."

---

## Minute 9–13: Live demo (the money shot)

Open Claude Code in the project. Type:

```
/steer-start Fix the crash when OTP expiry time is null in auth/OtpService
```

Walk through what happens:
1. **Context gathering** — "It's reading the codebase map and any knowledge we've built up about auth"
2. **CLEAR scoring** — "It's scoring the prompt for context, language, examples, audience, refinement"
3. **Planning** — "It's creating an execution plan — you approve before any code is written"
4. **Execution** — "Now it implements with the scope restriction active"

> "Notice it's not touching files outside auth/OtpService — that's R1 Scope Restriction doing its job."

After the task:

```
/steer-commit
```

> "Generates the commit message from the task context."

```
/steer-pr
```

> "Generates the PR description."

---

## Minute 13–15: Q&A + next steps

**Common questions to expect:**

**"What if I want Claude to touch something outside the declared scope?"**
> "It'll ask you explicitly. You can approve inline — it just makes the decision visible rather than silent."

**"Does this slow me down?"**
> "The first task in a project, maybe 30 seconds. After that it's faster because it has context and knowledge. The goal is fewer iteration loops, not more steps."

**"What if I'm mid-task and Claude Code resets?"**
> "`/steer-resume` picks up exactly where you left off."

**"What gets committed to git?"**
> "Everything in `.steer/` except `state/` and `embeddings/`. The knowledge base, rules, and templates are shared — that's the point."

**Next steps for everyone:**

1. Run `steer-agent init` in your active project repo
2. Commit `.steer/` to git
3. Try one real task with `/steer-start`
4. Post in `#dev-tools` with any friction you hit

---

## Troubleshooting during the session

**"steer-agent: command not found"**
```bash
# npm global bin not in PATH
export PATH="$(npm config get prefix)/bin:$PATH"
# Add to ~/.zshrc to make permanent
```

**"npm install fails"**
```bash
# Check registry
npm config get @coinswitch:registry
# Should be: https://artifactory.coinswitch.co/npm/
```

**"MCP tools not showing in Claude Code"**
> "Restart Claude Code — it reads settings.json on startup."

**Symlink errors on install**
```bash
steer-agent install --force
```
