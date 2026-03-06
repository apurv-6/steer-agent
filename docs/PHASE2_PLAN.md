# SteerAgent Phase 2 Plan

## 1. Goal

Build SteerAgent Phase 2 as a marketable **Agent Reliability Control Plane**:

- New Relic-style visibility for AI agents and multi-agent systems.
- Reliability + governance workflows, not just telemetry charts.
- Seamless developer UX: install once, mostly automatic instrumentation, low friction in daily coding.

This is directly aligned with SteerAgent's current strengths (FPCR, model routing, governance workflow) and extends it into a sellable team/enterprise platform.

## 2. Why This Is Valuable Now

The market is proving demand for AI observability:

- Datadog ships LLM observability with out-of-the-box integrations and auto instrumentation.
- New Relic AI Monitoring includes model interactions and MCP call lifecycle visibility.
- LangSmith, Langfuse, Braintrust, and Arize Phoenix each cover parts of tracing, evals, and debugging.

What is still missing for many engineering teams:

- **End-to-end reliability operations** for agentic workflows across IDE + MCP + runtime + CI.
- **Governance-native workflows** (policy checks, approvals, audit trails) tightly connected to developer execution.
- **Developer-first UX** that stays mostly invisible until intervention is needed.

SteerAgent can win by being the control layer between "agent execution" and "engineering standards."

## 3. Product Positioning

### Positioning statement

SteerAgent is the reliability and governance control plane for agentic software development.  
It helps engineering teams ship agent-assisted code safely, quickly, and with measurable quality.

### ICP (initial customer profile)

- 20 to 300 engineer orgs already using AI coding tools.
- Platform, infra, dev productivity, or architecture leaders who own SDLC quality/cost/risk.
- Regulated or audit-sensitive teams (fintech, healthtech, enterprise SaaS).

### Core buyer pains

- "We have AI coding adoption but no operational visibility."
- "We cannot explain why an AI-assisted change failed."
- "Policy/compliance and security checks are inconsistent across teams."
- "Cost is rising and quality is unpredictable."

## 4. Phase 2 Product Surface

Phase 2 should ship as one coherent system with four planes.

### A. Observe (Agent Tracing + Telemetry)

- Unified trace for each task run: prompt evolution, agent handoffs, tool calls, model calls, retries, failures.
- Span-level timeline with parent/child relationships across agents.
- Built-in support for multi-agent chains and MCP tool execution.
- Ingest OpenTelemetry-compatible traces/events for interoperability.

### B. Govern (Policy + Guardrails)

- Policy engine for rules by severity (`BLOCK`, `WARN`, `AUTO`) with org/team/project scopes.
- Pre-flight and in-flight checks: secret exposure, restricted module access, unsafe tool usage, missing validation.
- Human approval checkpoints for high-risk runs.
- Full audit log: who triggered what, which policy fired, who approved/overrode.

### C. Operate (Reliability Workflows)

- SLOs for agent systems: run success rate, time-to-success, failure budget, cost per successful run.
- Alerting and incident workflows for regressions in quality/cost/latency/policy violations.
- Failure replay and root-cause assistant using captured trace + context graph.
- Runbooks for common failure classes.

### D. Improve (Evaluation + Optimization)

- FPCR evolves into broader reliability scorecard:
  - First-pass completion rate
  - Rework rate
  - Policy violation rate
  - Mean time to recovery for failed runs
  - Cost per accepted outcome
- Regression detection when model/prompt/tool/rule changes impact outcomes.
- Suggest safe routing and policy updates based on historical outcomes.

## 5. UX Principles (Non-Bothersome by Default)

- Default mode is quiet: no interruption if run is healthy and policy-compliant.
- Action only when needed: concise intervention cards with exact next action.
- Single-click setup from CLI and extension.
- Progressive disclosure: "simple first, deep trace when debugging."
- Team-level defaults, local overrides with explicit audit.

## 6. User Experience Design Direction

### Primary workflows

- Developer workflow:
  - Start task normally.
  - See compact status strip (health, risk, model tier, cost trend).
  - Get intervention only when blocking risk or clear optimization opportunity appears.
- Team lead workflow:
  - Dashboard for reliability, policy compliance, quality, and cost across repos/teams.
  - Drill-down from red metric to concrete failing traces.
- Platform/admin workflow:
  - Configure org policies, SSO, RBAC, retention, and integrations.

### Dashboard modules

- Reliability overview (SLOs, incidents, failure classes).
- Trace explorer (agent graph + timeline + replay).
- Governance center (policy coverage, violations, approvals).
- Cost and model efficiency (tier usage, ROI, anomaly detection).
- Team adoption and outcomes (FPCR/rework by team, repo, workflow type).

## 7. Identity, Security, and Multi-Tenancy

- Authentication:
  - Start with GitHub OAuth + email magic link for fast onboarding.
  - Add enterprise SSO (SAML/OIDC) in enterprise tier.
- Authorization:
  - Org -> team -> project RBAC roles.
  - Role templates: Admin, Platform, TeamLead, Developer, Viewer.
- Data boundaries:
  - Hard tenant isolation in storage/query path.
  - Scoped API keys per workspace/project.
- Security foundations:
  - Encryption in transit and at rest.
  - Audit logs immutable and exportable.
  - Configurable retention and redaction for sensitive prompt/context data.

## 8. Technical Architecture (Phase 2)

### Existing assets to reuse

- Core workflow engine and state model.
- MCP server orchestration layer.
- CLI install/init/status/doctor patterns.
- Cursor extension surface and FPCR tab foundation.

### New services

- `steer-ingest`:
  - Receives traces/events from CLI/extension/MCP/runtime SDK.
  - Validates schema, enriches metadata, queues writes.
- `steer-query`:
  - Serves dashboard and API queries.
  - Supports trace drill-down, metric aggregation, policy/event search.
- `steer-policy`:
  - Evaluates rules on events/runs.
  - Emits decisions, approvals required, and violation events.
- `steer-auth`:
  - Handles orgs, users, API keys, RBAC, SSO/OAuth.
- `steer-web`:
  - Dashboard UI and admin console.

### Data model additions

- `Run`: top-level execution context across all agents.
- `Span`: unit of work (prompt patch, model call, tool call, policy check, retry).
- `PolicyEvent`: evaluation output, severity, actor, decision.
- `Outcome`: accepted/reworked/rejected plus cycle time and quality markers.
- `CostEvent`: token/cost/utilization dimensions per provider/model/tool.

### Instrumentation strategy

- Keep JSONL local telemetry for offline mode.
- Add optional cloud export (async + buffered + retry).
- Expose OpenTelemetry bridge and Steer schema adapters.
- Provide framework adapters incrementally (MCP first, then LangGraph/AutoGen/CrewAI style hooks where feasible).

## 9. Delivery Roadmap

### Phase 2.0 (6 to 8 weeks): "Cloud Telemetry + Trace Explorer"

- Cloud ingest + query API.
- Auth (single-org baseline) + project keys.
- Instrumentation upgrade in CLI/extension/MCP.
- Trace explorer + reliability dashboard MVP.
- Alerting v1 on basic thresholds.

### Phase 2.1 (6 weeks): "Governance Center"

- Policy engine service.
- Org/team/project policy scopes.
- Approvals and override workflows.
- Governance dashboard + audit export.

### Phase 2.2 (6 weeks): "Reliability Ops + Optimization"

- SLOs, incident triage, replay assistant.
- Cost-performance optimizer recommendations.
- Comparative analysis across teams and repositories.

### Phase 2.3 (optional): "Enterprise Readiness"

- SAML/OIDC SSO.
- Data retention controls.
- Advanced compliance exports and controls.

## 10. Commercial Packaging

### Free / Starter

- Local mode + limited cloud retention.
- Basic dashboard and trace history.
- Community support.

### Team

- Full dashboards, alerts, policy center, standard retention.
- Slack/Jira integration.
- Role-based access.

### Enterprise

- SSO, advanced RBAC, custom retention, compliance exports, dedicated support.
- Private deployment options later if needed.

## 11. Success Metrics

- Product adoption:
  - Weekly active developers using SteerAgent workflow.
  - % of AI-assisted tasks with full traces.
- Reliability:
  - Run success rate and error budget burn.
  - Mean time to detect and resolve failed runs.
- Quality:
  - FPCR and rework rate trend.
  - Policy violation rate trend.
- Business:
  - Cost per accepted task.
  - Team expansion and paid conversion.

## 12. Risks and Mitigations

- Risk: "Observability only" becomes commodity.
  - Mitigation: own governance + intervention workflows tightly coupled to dev flow.
- Risk: instrumentation overhead hurts developer experience.
  - Mitigation: async buffering, sane defaults, low-noise UX.
- Risk: trust concerns with prompt/code data.
  - Mitigation: redaction, retention controls, transparent data policy, self-host path later.
- Risk: broad scope slows launch.
  - Mitigation: strict phase gates and MVP-first shipping.

## 13. Immediate Build Plan (Next Steps in Repo)

- Define canonical event schema v2 in `packages/core`.
- Add trace/span capture in MCP run pipeline.
- Implement cloud export toggle and retry buffer.
- Create backend skeleton (`ingest`, `query`, `auth`, `policy`) as separate packages.
- Build dashboard MVP with:
  - Reliability overview
  - Trace explorer
  - Policy violations list
- Extend extension sidebar:
  - Keep existing FPCR tab
  - Add lightweight "Reliability" and "Incidents" cards

## 14. Research Signals Used

- [Datadog LLM Observability](https://www.datadoghq.com/product/llm-observability/)
- [Datadog docs: LLM Observability](https://docs.datadoghq.com/llm_observability/)
- [New Relic AI Monitoring](https://newrelic.com/platform/ai-monitoring)
- [LangSmith observability docs](https://docs.langchain.com/langsmith/observability)
- [Langfuse docs](https://langfuse.com/docs/observability/overview)
- [Langfuse GitHub repository](https://github.com/langfuse/langfuse)
- [Braintrust docs](https://www.braintrust.dev/docs/start)
- [Arize Phoenix docs](https://docs.arize.com/phoenix)
- [OpenTelemetry semantic conventions for Generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/)
- [Model Context Protocol docs](https://modelcontextprotocol.io/docs/getting-started/intro)
- [OpenAI Agents SDK tracing](https://platform.openai.com/docs/guides/agents-tracing)
- [MCP security best practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices)
