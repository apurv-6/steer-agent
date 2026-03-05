# Slack Announcement — #mobile-eng

> Copy into Slack. Adjust dates before posting.

---

Hey team 👋

We're rolling out **SteerAgent** to the mobile-eng team this week — an AI workflow tool that wraps Claude Code sessions in structured, governed workflows.

**What it does:**
- Enforces scope restriction (Claude can't edit files outside your declared scope)
- Guards auth/ and payments/ — requires explicit approval for those changes
- Builds a team knowledge base that compounds over time
- Tracks prompt quality (FPCR) so we can see improvement

**Setup takes < 5 minutes:**

```bash
npm config set @coinswitch:registry https://artifactory.coinswitch.co/npm/
npm install -g @coinswitch/steer-agent
steer-agent install
```

Then in your project:
```bash
steer-agent init --template coinswitch
```

Full guide: [Confluence link]

**Walkthrough session:** [DATE] at [TIME] — 15 minutes, everyone follows along live. Attendance strongly encouraged for the first week.

Questions or issues → reply here or `#dev-tools`

— [YOUR NAME]
