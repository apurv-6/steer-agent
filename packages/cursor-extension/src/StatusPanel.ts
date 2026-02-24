import * as vscode from "vscode";
import type { SessionState, SessionStateData } from "./SessionState";

export class StatusPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "steeragent.statusPanel";
  private _view?: vscode.WebviewView;

  constructor(private readonly state: SessionState) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;
    view.webview.options = { enableScripts: true };
    this.render(this.state.data);
    this.state.onDidChange((data) => this.render(data));
  }

  private render(data: SessionStateData): void {
    if (!this._view) return;

    const scoreColor = data.lastScore !== null
      ? data.lastScore >= 7 ? "#2ea043"
        : data.lastScore >= 4 ? "#d29922"
        : "#f85149"
      : "var(--vscode-descriptionForeground)";

    const statusColor = data.lastStatus === "READY" ? "#2ea043"
      : data.lastStatus === "NEEDS_INFO" ? "#d29922"
      : data.lastStatus === "BLOCKED" ? "#f85149"
      : "var(--vscode-descriptionForeground)";

    this._view.webview.html = /* html */ `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 8px; color: var(--vscode-foreground); font-size: 12px; }
    .row { margin: 5px 0; display: flex; justify-content: space-between; }
    .label { font-weight: bold; opacity: 0.8; }
    .value { text-align: right; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; }
    .on { background: #2ea043; color: #000; }
    .off { background: #f85149; color: #fff; }
    .divider { border-top: 1px solid var(--vscode-widget-border); margin: 8px 0; }
    .score { font-size: 24px; font-weight: bold; color: ${scoreColor}; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; background: ${statusColor}; color: #fff; }
  </style>
</head>
<body>
  <div class="row">
    <span class="label">Steer</span>
    <span class="badge ${data.steerEnabled ? "on" : "off"}">${data.steerEnabled ? "ON" : "OFF"}</span>
  </div>
  <div class="row">
    <span class="label">Mode</span>
    <span class="value">${data.mode}</span>
  </div>

  <div class="divider"></div>

  <div class="row">
    <span class="label">Score</span>
    <span class="score">${data.lastScore !== null ? data.lastScore + "/10" : "\u2014"}</span>
  </div>
  ${data.lastStatus ? `<div class="row"><span class="label">Status</span><span class="status-badge">${data.lastStatus}</span></div>` : ""}

  <div class="divider"></div>

  <div class="row">
    <span class="label">Model tier</span>
    <span class="value">${data.lastModelTier ? data.lastModelTier.toUpperCase() : "\u2014"}</span>
  </div>
  <div class="row">
    <span class="label">Gate calls</span>
    <span class="value">${data.gateCallCount}</span>
  </div>

  <div class="divider"></div>

  <div class="row">
    <span class="label">Task</span>
    <span class="value" style="font-size:10px;opacity:0.7">${data.taskId ?? "\u2014"}</span>
  </div>
  <div class="row">
    <span class="label">Turn</span>
    <span class="value">${data.turnId || "\u2014"}</span>
  </div>
</body>
</html>`;
  }
}
