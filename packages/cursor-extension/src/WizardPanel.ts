import * as vscode from "vscode";
import type { SessionState } from "./SessionState";
import { callGate, type GateResult } from "./gateClient";

export class WizardPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "steeragent.wizardPanel";
  private _view?: vscode.WebviewView;
  private _lastGateResult: GateResult | null = null;
  private _lastDraftPrompt: string | null = null;

  constructor(private readonly state: SessionState) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;
    view.webview.options = { enableScripts: true };
    this.render();
    this.state.onDidChange(() => this.render());

    view.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "applyToChat":
          vscode.commands.executeCommand("steeragent.applyToChat");
          break;
        case "override":
          vscode.commands.executeCommand("steeragent.applyToChat");
          break;
        case "submitAnswers":
          this.handleReEvaluate(msg.answers);
          break;
        case "copyPrompt":
          if (this._lastGateResult?.patchedPrompt) {
            vscode.env.clipboard.writeText(this._lastGateResult.patchedPrompt);
            vscode.window.showInformationMessage("Patched prompt copied to clipboard");
          }
          break;
      }
    });
  }

  setDraftPrompt(prompt: string): void {
    this._lastDraftPrompt = prompt;
  }

  updateGateResult(result: GateResult): void {
    this._lastGateResult = result;
    this.render();
  }

  getLastGateResult(): GateResult | null {
    return this._lastGateResult;
  }

  private handleReEvaluate(answers: Record<string, string>): void {
    if (!this._lastDraftPrompt) {
      vscode.window.showWarningMessage("No draft prompt to re-evaluate.");
      return;
    }

    const mappedAnswers: Record<string, string> = {};
    if (this._lastGateResult) {
      for (const [key, value] of Object.entries(answers)) {
        if (!value) continue;
        const idx = parseInt(key, 10);
        const q = this._lastGateResult.followupQuestions[idx];
        if (!q) continue;
        const qLower = q.question.toLowerCase();
        if (qLower.includes("goal") || qLower.includes("outcome")) mappedAnswers["goal_outcome"] = value;
        else if (qLower.includes("limit") || qLower.includes("constraint") || qLower.includes("scope")) mappedAnswers["scope_limits"] = value;
        else if (qLower.includes("review") || qLower.includes("verif") || qLower.includes("test") || qLower.includes("repro")) mappedAnswers["review_verify"] = value;
        else mappedAnswers[`answer_${idx}`] = value;
      }
    }

    let result;
    try {
      const newTurnId = (this.state.data.turnId || 0) + 1;
      result = callGate(
        this._lastDraftPrompt,
        this.state.data.mode,
        mappedAnswers,
        this.state.data.taskId ?? undefined,
        newTurnId,
      );
      this._lastGateResult = result;
      this.state.update({
        gateCallCount: this.state.data.gateCallCount + 1,
        turnId: newTurnId,
        lastModelTier: result.modelSuggestion.tier,
        lastPatchedPrompt: result.patchedPrompt,
        lastScore: result.score,
        lastStatus: result.status,
      });
    } catch (err) {
      vscode.window.showErrorMessage(`[steer] Re-evaluate failed: ${err}`);
      this.state.update({ lastStatus: "ERROR" });
      return;
    }
    this.render();

    if (result.status === "READY") {
      vscode.window.showInformationMessage(`Re-evaluated: READY (score ${result.score}/10) \u2014 click Apply`);
    } else {
      vscode.window.showInformationMessage(`Re-evaluated: ${result.status} (score ${result.score}/10)`);
    }
  }

  private render(): void {
    if (!this._view) return;
    const r = this._lastGateResult;

    // Follow-up questions HTML
    let questionsHtml = "";
    if (r && r.followupQuestions.length > 0) {
      questionsHtml = r.followupQuestions
        .map((q, i) => {
          if (q.type === "mcq" && q.options) {
            const opts = q.options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
            return `<div class="q"><label>${esc(q.question)}</label><select id="q${i}">${opts}</select></div>`;
          }
          return `<div class="q"><label>${esc(q.question)}</label><input type="text" id="q${i}" placeholder="Your answer..." /></div>`;
        })
        .join("");
      questionsHtml += `<button id="reEvalBtn" class="btn primary" style="margin-top:8px;">Re-evaluate</button>`;
    }

    // Next action guidance
    const nextActionMap: Record<string, string> = {
      block: "Prompt is too vague. Add structure (GOAL, LIMITS, REVIEW) or override.",
      answer_questions: "Answer the follow-up questions below, then click Re-evaluate.",
      review_and_apply: "Review the patched prompt and click Apply when ready.",
      apply: "Prompt is ready. Click Apply to use the patched version.",
    };
    const nextActionText = r ? (nextActionMap[r.nextAction] ?? "") : "";

    // Model suggestion HTML
    let modelHtml = "\u2014";
    if (r) {
      modelHtml = `
        <div class="tier-badge tier-${r.modelSuggestion.tier}">${r.modelSuggestion.tier.toUpperCase()}</div>
        <div class="model-detail">${esc(r.modelSuggestion.modelName)} <span class="provider">(${esc(r.modelSuggestion.provider)})</span></div>
        <div class="meta">Est. cost: $${r.costEstimate.estimatedCostUsd.toFixed(4)} (~${r.costEstimate.estimatedTokens} tokens)</div>
        <div class="meta">${esc(r.modelSuggestion.reason)}</div>
      `;
    }

    const statusClass = r ? r.status.toLowerCase() : "";
    const isBlocked = r?.status === "BLOCKED";
    const hasPrompt = !!r?.patchedPrompt;

    this._view.webview.html = /* html */ `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 8px; color: var(--vscode-foreground); font-size: 12px; }
    h3 { margin: 10px 0 4px; font-size: 13px; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 4px; }
    .badge { padding: 2px 8px; border-radius: 3px; font-weight: bold; font-size: 11px; color: #fff; }
    .ready { background: #2ea043; }
    .needs_info { background: #d29922; color: #000; }
    .blocked { background: #f85149; }
    pre { white-space: pre-wrap; font-size: 11px; background: var(--vscode-editor-background); padding: 8px; border-radius: 4px; max-height: 200px; overflow-y: auto; border: 1px solid var(--vscode-widget-border); }
    .q { margin: 6px 0; }
    .q label { display: block; font-weight: bold; margin-bottom: 2px; font-size: 11px; }
    .q input, .q select { width: 100%; padding: 4px; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; }
    .btn { padding: 6px 14px; cursor: pointer; border: none; border-radius: 3px; font-size: 12px; }
    .primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .primary:hover { background: var(--vscode-button-hoverBackground); }
    .secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .meta { color: var(--vscode-descriptionForeground); margin: 2px 0; font-size: 11px; }
    .next-action { background: var(--vscode-editor-inactiveSelectionBackground); padding: 6px 8px; border-radius: 4px; margin: 6px 0; font-size: 11px; }
    .tier-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-weight: bold; font-size: 11px; }
    .tier-small { background: #388bfd; color: #fff; }
    .tier-mid { background: #d29922; color: #000; }
    .tier-high { background: #f85149; color: #fff; }
    .model-detail { margin: 4px 0; font-size: 11px; }
    .provider { opacity: 0.7; }
    .actions { margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; }
  </style>
</head>
<body>
  ${r ? `
    <h3>Gate Result <span class="badge ${statusClass}">${r.status}</span></h3>
    <div class="meta">Score: <strong>${r.score}/10</strong></div>
    ${r.missing.length ? `<div class="meta">Missing: ${r.missing.join(", ")}</div>` : ""}
    <div class="next-action">${esc(nextActionText)}</div>
  ` : `<h3>Steer Gate</h3><div class="meta">Run <strong>Steer Agent: Suggest</strong> or use <strong>@steer</strong> in chat to evaluate a prompt.</div>`}

  ${questionsHtml ? `<h3>Follow-up Questions</h3>${questionsHtml}` : ""}

  ${r ? `
    <h3>Patched Prompt</h3>
    ${hasPrompt ? `<pre>${esc(r.patchedPrompt!)}</pre>` : "<div class='meta'>Score too low to patch. Answer questions first.</div>"}

    <h3>Model Suggestion</h3>
    ${modelHtml}
  ` : ""}

  <div class="actions">
    ${r && hasPrompt && !isBlocked ? '<button id="applyBtn" class="btn primary">Apply to Chat</button>' : ""}
    ${r && hasPrompt ? '<button id="copyBtn" class="btn secondary">Copy Prompt</button>' : ""}
    ${isBlocked ? '<button id="overrideBtn" class="btn secondary">Override (requires reason)</button>' : ""}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t.id === 'applyBtn') vscode.postMessage({ type: 'applyToChat' });
      else if (t.id === 'overrideBtn') vscode.postMessage({ type: 'override' });
      else if (t.id === 'copyBtn') vscode.postMessage({ type: 'copyPrompt' });
      else if (t.id === 'reEvalBtn') {
        const answers = {};
        const count = ${r?.followupQuestions.length ?? 0};
        for (let i = 0; i < count; i++) {
          const el = document.getElementById('q' + i);
          if (el) answers[i] = el.value;
        }
        vscode.postMessage({ type: 'submitAnswers', answers });
      }
    });
  </script>
</body>
</html>`;
  }
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
