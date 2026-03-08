import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import type { SessionState } from "../SessionState";

export type SidebarTab = "task" | "knowledge" | "fpcr" | "map" | "rules" | "log";

// ─── Design Tokens (Catppuccin-inspired) ───────────
const C = {
  bg: "#1e1e2e",
  bgAlt: "#181825",
  surface: "#252538",
  surfaceHover: "#2a2a40",
  border: "#313244",
  borderActive: "#f5a623",
  text: "#cdd6f4",
  textDim: "#6c7086",
  textMuted: "#45475a",
  accent: "#f5a623",
  accentDim: "#f5a62344",
  green: "#a6e3a1",
  greenDim: "#a6e3a122",
  red: "#f38ba8",
  redDim: "#f38ba822",
  blue: "#89b4fa",
  blueDim: "#89b4fa22",
  purple: "#cba6f7",
  purpleDim: "#cba6f722",
  teal: "#94e2d5",
  yellow: "#f9e2af",
};

// ─── SVG Icons (inline) ───────────────────────────
const ICONS = {
  bolt: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  brain: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><path d="M9 22h6"/></svg>`,
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  chart: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  layers: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  shield: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  play: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  search: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  alert: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  code: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  arrowUp: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  arrowDown: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
  git: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>`,
};

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "steeragent.sidebar";
  private _view?: vscode.WebviewView;
  private _activeTab: SidebarTab = "task";
  private _taskData: any = null;
  private _watchers: vscode.FileSystemWatcher[] = [];
  private _refreshTimer?: ReturnType<typeof setTimeout>;
  private _sessionDisposable?: vscode.Disposable;
  private _expandedModules: Set<string> = new Set();
  private _pollTimer?: ReturnType<typeof setInterval>;
  private _lastTaskMtime: number = 0;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _sessionState?: SessionState,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;
    view.webview.options = { enableScripts: true };

    view.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "switchTab") {
        this._activeTab = msg.tab;
        this.refresh();
      } else if (msg.type === "command") {
        vscode.commands.executeCommand(msg.command);
      } else if (msg.type === "startTask") {
        vscode.commands.executeCommand("steeragent.startTask", msg.goal);
      } else if (msg.type === "expandModule") {
        if (this._expandedModules.has(msg.module)) {
          this._expandedModules.delete(msg.module);
        } else {
          this._expandedModules.add(msg.module);
        }
        this.refresh();
      }
    });

    // Watch all data sources for live updates
    const watchPatterns = [
      "**/.steer/state/current-task.json",
      "**/.steer/state/history.jsonl",
      "**/.steer/state/learnings.jsonl",
      "**/.steer/knowledge/*.md",
      "**/.steer/codebase-map.json",
      "**/.steer/RULES.md",
      "**/.steer/hooks.yaml",
      "**/.steer/state/steer.log",
    ];

    for (const pattern of watchPatterns) {
      const w = vscode.workspace.createFileSystemWatcher(pattern);
      const handler = pattern.includes("current-task.json")
        ? () => this.loadTaskState()
        : () => this.debouncedRefresh();
      w.onDidChange(handler);
      w.onDidCreate(handler);
      w.onDidDelete(() => this.debouncedRefresh());
      this._watchers.push(w);
    }

    // Subscribe to SessionState changes — reload task data (not just refresh)
    if (this._sessionState) {
      this._sessionDisposable = this._sessionState.onDidChange(() => this.loadTaskState());
    }

    this.loadTaskState();
    this.refresh();

    // Poll task file every 2s as fallback for missed watcher events
    // (VS Code watchers can miss or delay changes from external processes)
    this._pollTimer = setInterval(() => this.pollTaskState(), 2000);
  }

  private getTaskPath(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return null;
    return vscode.Uri.joinPath(folders[0].uri, ".steer", "state", "current-task.json").fsPath;
  }

  private loadTaskState(): void {
    const taskPath = this.getTaskPath();
    if (!taskPath) return;
    try {
      const stat = fs.statSync(taskPath);
      this._lastTaskMtime = stat.mtimeMs;
      this._taskData = JSON.parse(fs.readFileSync(taskPath, "utf-8"));
    } catch {
      this._taskData = null;
    }
    this.refresh();
  }

  /** Poll-based fallback: reload only when mtime changes. */
  private pollTaskState(): void {
    const taskPath = this.getTaskPath();
    if (!taskPath) return;
    try {
      const stat = fs.statSync(taskPath);
      if (stat.mtimeMs !== this._lastTaskMtime) {
        this.loadTaskState();
      }
    } catch {
      // File may not exist yet — ignore
      if (this._taskData !== null) {
        this._taskData = null;
        this._lastTaskMtime = 0;
        this.refresh();
      }
    }
  }

  private debouncedRefresh(): void {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => this.refresh(), 300);
  }

  setTab(tab: SidebarTab): void {
    this._activeTab = tab;
    this.refresh();
  }

  refresh(): void {
    if (!this._view) return;

    let tabContent: string;
    try {
      tabContent = this.getTabContent();
    } catch (err) {
      tabContent = `<div class="card"><div class="label">Error loading tab</div><pre style="color:${C.red}">${String(err)}</pre></div>`;
      console.error("[steer] Tab render error:", err);
    }

    const sessionData = this._sessionState?.data;

    this._view.webview.html = /* html */ `<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${C.bg};
      color: ${C.text};
      font-size: 12px;
      overflow: hidden;
      height: 100vh;
    }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
    input::placeholder { color: ${C.textMuted}; }

    /* ─── Layout ─── */
    .shell { display: flex; flex-direction: column; height: 100vh; }
    .title-bar {
      display: flex; align-items: center; padding: 8px 12px; gap: 8px;
      background: ${C.bgAlt}; border-bottom: 1px solid ${C.border};
      flex-shrink: 0;
    }
    .logo {
      width: 20px; height: 20px; border-radius: 4px;
      background: linear-gradient(135deg, ${C.accent}, #e8950a);
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 900; color: ${C.bgAlt};
    }
    .title-text { font-size: 12px; font-weight: 700; color: ${C.text}; letter-spacing: -0.01em; }
    .connected { display: flex; align-items: center; gap: 6px; margin-left: auto; }
    .connected-dot { width: 6px; height: 6px; border-radius: 50%; background: ${C.green}; animation: pulse 2s infinite; }
    .connected-text { font-size: 9px; color: ${C.green}; }

    .main { display: flex; flex: 1; overflow: hidden; }

    /* ─── Tab Rail ─── */
    .tab-rail {
      display: flex; flex-direction: column; background: ${C.bgAlt};
      border-right: 1px solid ${C.border}; padding-top: 4px; flex-shrink: 0;
    }
    .tab-btn {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      padding: 8px 2px; width: 48px; background: transparent;
      border: none; border-left: 2px solid transparent;
      color: ${C.textDim}; cursor: pointer; position: relative;
      transition: all 0.15s; font-family: inherit;
    }
    .tab-btn:hover { color: ${C.text}; }
    .tab-btn.active {
      background: ${C.surface}; border-left-color: ${C.accent}; color: ${C.accent};
    }
    .tab-btn span { font-size: 8px; font-weight: 500; letter-spacing: 0.03em; }
    .tab-badge {
      position: absolute; top: 4px; right: 6px;
      width: 14px; height: 14px; border-radius: 50%;
      background: ${C.red}; color: #fff;
      font-size: 8px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }

    /* ─── Content ─── */
    .content {
      flex: 1; padding: 10px; overflow-y: auto; overflow-x: hidden;
      display: flex; flex-direction: column; gap: 10px;
    }

    /* ─── Status Bar ─── */
    .status-bar {
      display: flex; align-items: center; padding: 4px 10px;
      background: ${C.bgAlt}; border-top: 1px solid ${C.border};
      gap: 8px; font-size: 9px; color: ${C.textDim}; flex-shrink: 0;
    }
    .status-bar .sep { color: ${C.border}; }

    /* ─── Shared Components ─── */
    .pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 99px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .pill-sm { padding: 1px 6px; font-size: 9px; }
    .card {
      padding: 8px 10px; border-radius: 8px;
      background: ${C.surface}; border: 1px solid ${C.border};
    }
    .section-title {
      font-size: 10px; font-weight: 600; color: ${C.textDim};
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .progress-track { width: 100%; height: 3px; background: ${C.bgAlt}; border-radius: 2px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 2px; transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1); }

    /* ─── Workflow Steps ─── */
    .wf-step { display: flex; align-items: center; gap: 8px; padding: 4px 0; transition: opacity 0.3s; }
    .wf-step.pending { opacity: 0.4; }
    .wf-circle {
      width: 20px; height: 20px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700; transition: all 0.3s;
    }
    .wf-circle.done { background: ${C.green}; color: ${C.bgAlt}; border: 2px solid ${C.green}; }
    .wf-circle.active { background: transparent; color: ${C.accent}; border: 2px solid ${C.accent}; box-shadow: 0 0 8px ${C.accent}44; }
    .wf-circle.pending-c { background: transparent; color: ${C.textMuted}; border: 2px solid ${C.textMuted}; }
    .wf-label { font-size: 11px; color: ${C.textDim}; font-weight: 400; }
    .wf-label.active { color: ${C.text}; font-weight: 600; }

    /* ─── Knowledge Cards ─── */
    .k-card {
      padding: 8px 10px; border-radius: 6px;
      background: ${C.bgAlt}; margin-bottom: 6px;
    }
    .k-card-gotcha { border-left: 3px solid ${C.red}; }
    .k-card-pattern { border-left: 3px solid ${C.green}; }
    .k-card-failed { border-left: 3px solid ${C.red}; }
    .k-card-convention { border-left: 3px solid ${C.blue}; }

    /* ─── Metric Cards ─── */
    .metric-card {
      padding: 10px 12px; border-radius: 8px;
      background: ${C.surface}; border: 1px solid ${C.border};
      flex: 1; min-width: 0;
    }
    .metric-label {
      font-size: 9px; color: ${C.textDim}; text-transform: uppercase;
      letter-spacing: 0.06em; margin-bottom: 6px;
    }
    .metric-value {
      font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .metric-unit { font-size: 10px; color: ${C.textDim}; }
    .metric-trend { display: flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 9px; }

    /* ─── Animations ─── */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <!-- Title Bar -->
    <div class="title-bar">
      <div class="logo">S</div>
      <span class="title-text">SteerAgent</span>
      <div class="pill pill-sm" style="color:${C.accent};background:${C.accent}18;border:1px solid ${C.accent}33">
        ${this.getProjectName()}
      </div>
      <div class="connected">
        <div class="connected-dot"></div>
        <span class="connected-text">Connected</span>
      </div>
    </div>

    <div class="main">
      <!-- Tab Rail -->
      <div class="tab-rail">
        ${this.renderTabButton("task", ICONS.bolt, "TASK")}
        ${this.renderTabButton("knowledge", ICONS.brain, "KNOW", this.getKnowledgeBadge())}
        ${this.renderTabButton("fpcr", ICONS.chart, "FPCR")}
        ${this.renderTabButton("map", ICONS.layers, "MAP")}
        ${this.renderTabButton("rules", ICONS.shield, "RULES")}
        ${this.renderTabButton("log", ICONS.code, "LOG")}
      </div>

      <!-- Content -->
      <div class="content">
        ${tabContent}
      </div>
    </div>

    <!-- Status Bar -->
    <div class="status-bar">
      <span style="color:${C.green}">●</span>
      <span>MCP Ready</span>
      <span class="sep">|</span>
      <span>${this.getMapSummary()}</span>
      <span class="sep">|</span>
      <span>${sessionData?.lastModelTier ? this.getModelLabel(sessionData.lastModelTier) : "Sonnet 4"}</span>
      <span style="margin-left:auto;font-variant-numeric:tabular-nums">
        FPCR: <span style="color:${C.green};font-weight:600">${this.getFpcrValue()}%</span>
      </span>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function switchTab(tab) { vscode.postMessage({ type: 'switchTab', tab }); }
    function runCommand(cmd) { vscode.postMessage({ type: 'command', command: cmd }); }
    function startTaskFromInput() {
      const input = document.getElementById('task-input');
      const goal = input ? input.value.trim() : '';
      vscode.postMessage({ type: 'startTask', goal });
    }
  </script>
</body>
</html>`;
  }

  // ─── Tab Button Helper ─────────────────────────
  private renderTabButton(id: SidebarTab, icon: string, label: string, badge?: string): string {
    const active = this._activeTab === id;
    return `<button class="tab-btn ${active ? "active" : ""}" onclick="switchTab('${id}')">
      ${icon}
      <span>${label}</span>
      ${badge ? `<div class="tab-badge">${badge}</div>` : ""}
    </button>`;
  }

  // ─── Helpers ───────────────────────────────────
  private getProjectName(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return "Project";
    return path.basename(folders[0].uri.fsPath);
  }

  private getKnowledgeBadge(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return undefined;
    try {
      const dir = vscode.Uri.joinPath(folders[0].uri, ".steer", "knowledge").fsPath;
      const files = fs.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
      return files.length > 0 ? String(files.length) : undefined;
    } catch {
      return undefined;
    }
  }

  private getMapSummary(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return "No map";
    try {
      const mapPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "codebase-map.json").fsPath;
      const map = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
      const files = Object.keys(map.files || {}).length;
      return `Map: ${files} files`;
    } catch {
      return "No map";
    }
  }

  private getFpcrValue(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return "—";
    try {
      const historyPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "state", "history.jsonl").fsPath;
      const raw = fs.readFileSync(historyPath, "utf-8");
      const records = raw.trim().split("\n").filter(Boolean).map((l: string) => JSON.parse(l));
      if (records.length === 0) return "—";
      const passed = records.filter((r: any) => r.fpcr === true || r.firstPassComplete === true || r.resolution === "passed");
      return ((passed.length / records.length) * 100).toFixed(1);
    } catch {
      return "—";
    }
  }

  private getModelLabel(tier: string): string {
    return tier;
  }

  private esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ─── Pill HTML helper ──────────────────────────
  private pill(text: string, color: string, small = false): string {
    return `<span class="pill ${small ? "pill-sm" : ""}" style="color:${color};background:${color}18;border:1px solid ${color}33">${text}</span>`;
  }

  // ─── Score Ring SVG ────────────────────────────
  private scoreRing(score: number, size = 44): string {
    const sw = 4;
    const r = (size - sw) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const color = score >= 80 ? C.green : score >= 50 ? C.accent : C.red;
    return `<svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${C.bgAlt}" stroke-width="${sw}" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
        style="transition:stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" />
      <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central"
        fill="${color}" font-size="14" font-weight="700"
        style="transform:rotate(90deg);transform-origin:center">${score}</text>
    </svg>`;
  }

  // ─── Model Tag HTML ────────────────────────────
  private modelTag(tier: string | null, reason?: string): string {
    const normalized = this.normalizeTier(tier);
    const colors: Record<string, string> = { high: C.purple, mid: C.blue, small: C.teal };
    const descs: Record<string, string> = { high: "Critical / Complex", mid: "Standard Tasks", small: "Quick / Simple" };
    const color = (normalized ? colors[normalized] : null) || C.textDim;
    const desc = reason ? this.esc(reason) : (normalized ? descs[normalized] : "Pending");
    const label = tier ? this.esc(tier) : "Not set";
    return `<div style="display:flex;align-items:center;gap:6px">
      <div style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}66"></div>
      <span style="font-size:11px;font-weight:600;color:${color}">${label}</span>
      <span style="font-size:9px;color:${C.textDim}">${desc}</span>
    </div>`;
  }

  // ─── Tab Content Router ────────────────────────
  private getTabContent(): string {
    switch (this._activeTab) {
      case "task": return this.renderTaskTab();
      case "knowledge": return this.renderKnowledgeTab();
      case "fpcr": return this.renderFpcrTab();
      case "map": return this.renderMapTab();
      case "rules": return this.renderRulesTab();
      case "log": return this.renderLogTab();
      default: return "";
    }
  }

  // ═══════════════════════════════════════════════
  // ─── TASK TAB ─────────────────────────────────
  // ═══════════════════════════════════════════════
  private renderTaskTab(): string {
    if (!this._taskData) {
      return `<div class="card" style="text-align:center;padding:24px">
        <div style="color:${C.textDim};margin-bottom:8px">${ICONS.bolt}</div>
        <div style="font-size:11px;font-weight:600;color:${C.text}">No active task</div>
        <div style="font-size:10px;color:${C.textDim};margin-top:4px;margin-bottom:12px">Use steer.start to begin a new task</div>
        <button onclick="runCommand('steeragent.newTask')" style="padding:6px 14px;border-radius:4px;background:${C.accent};border:none;color:${C.bgAlt};font-size:10px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:inherit">
          ${ICONS.play} New Task
        </button>
      </div>`;
    }

    const t = this._taskData;
    const steps = ["context", "prompt", "planning", "execution", "reflection", "verification", "learning", "done"];
    const effectiveStep = (t.currentStep === "idle" || !t.currentStep) ? "context" : t.currentStep;
    const currentIdx = Math.max(0, steps.indexOf(effectiveStep));
    const sessionData = this._sessionState?.data;
    const rawTier = t.modelTier || t.model || sessionData?.lastModelTier;
    const modelTier = this.normalizeTier(rawTier);

    // Elapsed time
    const startedAt = t.steps?.[t.currentStep]?.startedAt;
    const elapsed = startedAt ? this.formatElapsed(new Date(startedAt)) : "";

    // ─── Active Task Header ───
    const header = `<div style="padding:10px 12px;border-radius:8px;background:linear-gradient(135deg,${C.accentDim},${C.purpleDim});border:1px solid ${C.accent}33">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:6px;color:${C.accent}">
          ${ICONS.bolt}
          <span style="font-size:11px;font-weight:700">${this.esc(t.taskId || "—")}</span>
        </div>
        ${this.pill("IN PROGRESS", C.green, true)}
      </div>
      <p style="font-size:12px;color:${C.text};font-weight:500;margin:0">
        ${this.esc(t.goal || t.mode || "Task in progress")}
      </p>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
        ${this.modelTag(rawTier ?? null, t.modelReason)}
        ${elapsed ? `<span style="font-size:9px;color:${C.textDim};margin-left:auto;display:flex;align-items:center;gap:4px">${ICONS.clock} ${elapsed}</span>` : ""}
      </div>
    </div>`;

    // ─── CLEAR Score ───
    const score = sessionData?.lastScore;
    const scoreValue = score !== null && score !== undefined ? Math.round((score / 10) * 100) : null;
    const clearSection = scoreValue !== null ? `<div class="card" style="display:flex;align-items:center;gap:12px">
      ${this.scoreRing(scoreValue)}
      <div style="flex:1">
        <div style="font-size:10px;font-weight:600;color:${C.text};margin-bottom:4px">CLEAR Score</div>
        <div style="display:flex;gap:3px">
          ${["C", "L", "E", "A", "R"].map((l, i) => {
      const v = [92, 78, 85, 80, 75][i];
      const clr = v >= 80 ? C.green : C.accent;
      return `<div style="width:18px;height:18px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;background:${clr}22;color:${clr};border:1px solid ${clr}33">${l}</div>`;
    }).join("")}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;color:${C.green}">✓ READY</div>
        <div style="font-size:8px;color:${C.textDim}">threshold: 70</div>
      </div>
    </div>` : "";

    // ─── Workflow Steps ───
    const progressPct = ((currentIdx + 1) / steps.length) * 100;
    const workflowSteps = steps.map((s, i) => {
      const status = i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
      const circleClass = status === "done" ? "wf-circle done" : status === "active" ? "wf-circle active" : "wf-circle pending-c";
      const labelClass = status === "active" ? "wf-label active" : "wf-label";
      const stepClass = `wf-step ${status === "pending" ? "pending" : ""}`;
      const inner = status === "done" ? ICONS.check : String(i + 1);
      const runningPill = status === "active" ? `<div style="margin-left:auto">${this.pill("RUNNING", C.accent, true)}</div>` : "";
      return `<div class="${stepClass}">
        <div class="${circleClass}">${inner}</div>
        <span class="${labelClass}">${this.stepLabel(s)}</span>
        ${runningPill}
      </div>`;
    }).join("");

    const workflow = `<div class="card" style="flex:1">
      <div class="section-title" style="margin-bottom:6px">Workflow — Step ${currentIdx + 1} of ${steps.length}</div>
      <div class="progress-track"><div class="progress-fill" style="width:${progressPct}%;background:${C.accent}"></div></div>
      <div style="margin-top:8px">${workflowSteps}</div>
    </div>`;

    // ─── Sub-Agents ───
    // MCP writes subAgentDecision: { shouldSplit, reason, agents: [{id, files, description}] }
    const subAgentDecision = t.subAgentDecision as { shouldSplit?: boolean; agents?: Array<{ id: string; files: string[]; description: string }> } | undefined;
    const subAgents = subAgentDecision?.shouldSplit ? (subAgentDecision.agents || []) : [];
    const subAgentSection = `<div class="card">
      <div class="section-title" style="margin-bottom:6px">Sub-Agents (Parallel)</div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${subAgents.length > 0 ? subAgents.map((a: any) => `<div style="display:flex;align-items:center;gap:6px">
          <div style="width:6px;height:6px;border-radius:50%;background:${C.green};animation:pulse 2s infinite"></div>
          <span style="font-size:10px;color:${C.text};flex:1">${this.esc(a.description || a.id || "Agent")}</span>
          <span style="font-size:9px;color:${C.textDim}">${a.files?.length ?? 0} files</span>
        </div>`).join("") : `<div style="font-size:10px;color:${C.textDim}">No sub-agents active</div>`}
      </div>
    </div>`;

    // ─── Task Input ───
    const taskInput = `<div style="padding:8px 10px;border-radius:8px;background:${C.bgAlt};border:1px solid ${C.border};margin-top:auto">
      <div style="display:flex;gap:6px">
        <input id="task-input" placeholder="Describe task or paste Jira ID..."
          style="flex:1;padding:6px 8px;border-radius:4px;background:${C.surface};border:1px solid ${C.border};color:${C.text};font-size:11px;outline:none;font-family:inherit" />
        <button onclick="runCommand('steeragent.newTask')" title="Reset to a fresh task" style="padding:6px 8px;border-radius:4px;background:${C.surface};border:1px solid ${C.border};color:${C.textDim};font-size:10px;font-weight:600;cursor:pointer;font-family:inherit">↺</button>
        <button onclick="startTaskFromInput()" style="padding:6px 10px;border-radius:4px;background:${C.accent};border:none;color:${C.bgAlt};font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:inherit">
          ${ICONS.play} STEER
        </button>
      </div>
    </div>`;

    return [header, clearSection, workflow, subAgentSection, taskInput].filter(Boolean).join("");
  }

  private normalizeTier(v: string | undefined | null): string | null {
    if (!v) return null;
    const l = v.toLowerCase();
    if (l === "small" || l === "mid" || l === "high") return l;
    if (l.includes("haiku")) return "small";
    if (l.includes("sonnet")) return "mid";
    if (l.includes("opus")) return "high";
    return null;
  }

  private stepLabel(step: string): string {
    const labels: Record<string, string> = {
      idle: "Idle",
      context: "Context Gathering",
      prompt: "Prompt Assembly",
      planning: "Planning",
      execution: "Execution",
      reflection: "Reflection",
      verification: "Verification",
      learning: "Learning Extract",
      done: "Output & PR",
    };
    return labels[step] || step;
  }

  private formatElapsed(start: Date): string {
    const diff = Math.floor((Date.now() - start.getTime()) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }

  // ═══════════════════════════════════════════════
  // ─── KNOWLEDGE TAB ────────────────────────────
  // ═══════════════════════════════════════════════
  private renderKnowledgeTab(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return this.emptyState("No workspace open");

    const parts: string[] = [];

    // Search bar
    parts.push(`<div style="display:flex;gap:6px;align-items:center;padding:6px 8px;border-radius:6px;background:${C.surface};border:1px solid ${C.border}">
      <span style="color:${C.textDim}">${ICONS.search}</span>
      <input placeholder="Search knowledge base..." style="flex:1;background:transparent;border:none;color:${C.text};font-size:11px;outline:none;font-family:inherit" readonly />
    </div>`);

    // Knowledge files
    const knowledgeDir = vscode.Uri.joinPath(folders[0].uri, ".steer", "knowledge").fsPath;
    try {
      const files = fs.readdirSync(knowledgeDir).filter((f: string) => f.endsWith(".md"));
      if (files.length > 0) {
        for (const f of files) {
          const moduleName = f.replace(".md", "");
          parts.push(`<div class="section-title" style="margin-top:4px">Module: ${this.esc(moduleName)}/</div>`);

          const content = fs.readFileSync(path.join(knowledgeDir, f), "utf-8");
          // Parse knowledge entries (###-delimited)
          const entries = content.split(/^### /m).filter(Boolean).slice(0, 5);
          for (const entry of entries) {
            const lines = entry.trim().split("\n");
            const header = lines[0] || "";
            const body = lines.slice(1).join("\n").trim();
            const type = this.inferKnowledgeType(header);
            parts.push(this.knowledgeCard(type, moduleName, body.slice(0, 200), header));
          }
        }
      }
    } catch {
      // Knowledge directory may not exist yet
    }

    // Learnings
    const learningsPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "state", "learnings.jsonl").fsPath;
    try {
      const raw = fs.readFileSync(learningsPath, "utf-8");
      const learnings = raw.trim().split("\n").filter(Boolean).map((l: string) => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);

      if (learnings.length > 0) {
        parts.push(`<div class="section-title" style="margin-top:8px">Recent Learnings</div>`);
        for (const learning of learnings.slice(-10)) {
          const type = learning.category || "pattern";
          parts.push(this.knowledgeCard(
            type,
            learning.module || "_global",
            learning.detail || learning.summary || "",
            learning.summary || "",
            learning.createdAt ? new Date(learning.createdAt).toLocaleDateString() : undefined,
          ));
        }
      }
    } catch {
      // Learnings file may not exist yet
    }

    if (parts.length <= 1) {
      parts.push(this.emptyState("No knowledge yet. Complete tasks with steer.learn to build knowledge."));
    }

    // Stats footer
    parts.push(`<div style="margin-top:auto;padding:8px 10px;border-radius:6px;background:${C.surface};border:1px solid ${C.border};display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:10px;color:${C.text};font-weight:600">Knowledge Stats</div>
        <div style="font-size:9px;color:${C.textDim}">${this.getKnowledgeStats()}</div>
      </div>
      ${this.pill("ACTIVE", C.green, true)}
    </div>`);

    return parts.join("");
  }

  private inferKnowledgeType(header: string): string {
    const h = header.toLowerCase();
    if (h.includes("gotcha") || h.includes("warning") || h.includes("careful")) return "gotcha";
    if (h.includes("failed") || h.includes("fail") || h.includes("error")) return "failed";
    if (h.includes("convention") || h.includes("rule") || h.includes("standard")) return "convention";
    return "pattern";
  }

  private knowledgeCard(type: string, module: string, content: string, header: string, from?: string): string {
    const cfg: Record<string, { color: string; icon: string; label: string }> = {
      gotcha: { color: C.red, icon: ICONS.alert, label: "GOTCHA" },
      pattern: { color: C.green, icon: ICONS.check, label: "PATTERN" },
      failed: { color: C.red, icon: ICONS.alert, label: "FAILED" },
      convention: { color: C.blue, icon: ICONS.code, label: "CONVENTION" },
    };
    const c = cfg[type] || cfg.pattern;
    return `<div class="k-card k-card-${type}">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="color:${c.color}">${c.icon}</span>
        ${this.pill(c.label, c.color, true)}
        <span style="font-size:9px;color:${C.textDim}">${this.esc(module)}/</span>
      </div>
      <p style="font-size:11px;color:${C.text};margin:0;line-height:1.5">${this.esc(content.slice(0, 200))}</p>
      ${from ? `<p style="font-size:9px;color:${C.textDim};margin:4px 0 0">From: ${this.esc(from)}</p>` : ""}
    </div>`;
  }

  private getKnowledgeStats(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return "No data";
    try {
      const dir = vscode.Uri.joinPath(folders[0].uri, ".steer", "knowledge").fsPath;
      const files = fs.readdirSync(dir).filter((f: string) => f.endsWith(".md")).length;
      let learnings = 0;
      try {
        const lPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "state", "learnings.jsonl").fsPath;
        learnings = fs.readFileSync(lPath, "utf-8").trim().split("\n").filter(Boolean).length;
      } catch {}
      return `${files} modules · ${learnings} learnings`;
    } catch {
      return "No data";
    }
  }

  // ═══════════════════════════════════════════════
  // ─── FPCR / METRICS TAB ──────────────────────
  // ═══════════════════════════════════════════════
  private renderFpcrTab(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return this.emptyState("No workspace open");

    // ── Gather data ──
    const historyPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "state", "history.jsonl").fsPath;
    let records: any[] = [];
    try {
      const raw = fs.readFileSync(historyPath, "utf-8");
      records = raw.trim().split("\n").filter(Boolean).map((l: string) => JSON.parse(l));
    } catch {}

    const logPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "state", "steer.log").fsPath;
    let logLines: string[] = [];
    try { logLines = fs.readFileSync(logPath, "utf-8").split("\n"); } catch {}

    let kFiles = 0;
    try {
      const dir = vscode.Uri.joinPath(folders[0].uri, ".steer", "knowledge").fsPath;
      kFiles = fs.readdirSync(dir).filter((f: string) => f.endsWith(".md")).length;
    } catch {}

    // ── Compute metrics ──
    const isPassed = (r: any) => r.fpcr === true || r.firstPassComplete === true || r.resolution === "passed";
    const getRounds = (r: any) => (r.rounds ?? r.round ?? 0) + 1;
    const total = records.length;
    const passed = records.filter(isPassed).length;
    const fpcrPct = total > 0 ? (passed / total * 100) : 0;
    const avgRounds = total > 0 ? records.reduce((s: number, r: any) => s + getRounds(r), 0) / total : 0;
    const avgDuration = total > 0 ? records.reduce((s: number, r: any) => s + (r.durationMs || 0), 0) / total : 0;
    const totalFiles = records.reduce((s: number, r: any) => s + (r.files?.length || 0), 0);
    const totalLearnings = records.reduce((s: number, r: any) => s + (r.learnings || 0), 0);

    // Parse gate scores from steer.log
    const gateScores: number[] = [];
    const gateCosts: number[] = [];
    for (const line of logLines) {
      if (!line.includes("steer.gate.done")) continue;
      const sm = line.match(/score=(\d+)/);
      if (sm) gateScores.push(Math.min(10, Number(sm[1])));
      const cm = line.match(/cost=([\d.]+)/);
      if (cm) gateCosts.push(Number(cm[1]));
    }
    const avgScore = gateScores.length > 0 ? (gateScores.reduce((a, b) => a + b, 0) / gateScores.length) : 0;
    const totalCost = gateCosts.reduce((a, b) => a + b, 0);

    // Model distribution from history
    const models: Record<string, number> = { high: 0, mid: 0, small: 0 };
    for (const r of records) {
      const t = String(r.modelTier || "small").toLowerCase();
      if (t in models) models[t]++;
      else models["small"]++;
    }
    const modelTotal = Object.values(models).reduce((a, b) => a + b, 0);
    const modelData = [
      { label: "Opus", key: "high", color: C.purple, count: models.high },
      { label: "Sonnet", key: "mid", color: C.blue, count: models.mid },
      { label: "Haiku", key: "small", color: C.teal, count: models.small },
    ];

    // Weekly FPCR trend (chunks of 5)
    const weeklyFpcr: number[] = [];
    for (let i = 0; i < Math.ceil(total / 5); i++) {
      const chunk = records.slice(i * 5, (i + 1) * 5);
      if (chunk.length > 0) {
        const p = chunk.filter(isPassed).length;
        weeklyFpcr.push(Math.round(p / chunk.length * 100));
      }
    }

    const parts: string[] = [];
    const cardStyle = `padding:12px;border-radius:10px;background:${C.surface};border:1px solid ${C.border}`;
    const sectionLabel = (t: string) => `<div style="font-size:8px;font-weight:700;color:${C.textDim};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${C.border};font-family:monospace">${t}</div>`;

    // ══════════════════════════════════════════════
    // ROW 1 — Hero Metrics (2x2)
    // ══════════════════════════════════════════════
    parts.push(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">`);
    parts.push(this.bigMetricCard("North Star", total > 0 ? fpcrPct.toFixed(1) : "—", "%", "FPCR", C.green, "First-Pass Completion Rate"));
    parts.push(this.bigMetricCard("Efficiency", total > 0 ? avgRounds.toFixed(1) : "—", "×", "Avg Rounds", C.accent, "Target: &lt; 1.5"));
    parts.push(this.bigMetricCard("Volume", String(total), "", "Tasks Done", C.blue, `${totalFiles} files changed`));
    parts.push(this.bigMetricCard("Quality", avgScore > 0 ? avgScore.toFixed(1) : "—", "/10", "Gate Score", C.purple, `${gateScores.length} prompts scored`));
    parts.push(`</div>`);

    // ══════════════════════════════════════════════
    // ROW 2 — Pass/Fail + Model Donut + Score Bars
    // ══════════════════════════════════════════════

    // Pass/Fail bars
    if (total > 0) {
      const last20 = records.slice(-20);
      const bars = last20.map((r: any, i: number) => {
        const p = isPassed(r);
        const opacity = (0.5 + (i / last20.length) * 0.5).toFixed(2);
        return `<div style="flex:1;height:32px;background:${p ? C.green : C.red};border-radius:3px;opacity:${opacity}" title="${r.taskId}: ${p ? "PASS" : "FAIL"}"></div>`;
      }).join("");

      parts.push(`<div style="${cardStyle}">
        ${sectionLabel(`Last ${last20.length} Tasks — Pass / Fail`)}
        <div style="display:flex;gap:3px;align-items:flex-end">${bars}</div>
        <div style="display:flex;justify-content:center;gap:14px;margin-top:8px">
          <span style="font-size:9px;color:${C.green}">● Pass (${passed})</span>
          <span style="font-size:9px;color:${C.red}">● Fail (${total - passed})</span>
        </div>
      </div>`);
    }

    // Model Routing Donut
    if (modelTotal > 0) {
      const r = 38, sw = 14, circ = 2 * Math.PI * r;
      let offset = 0;
      const slices = modelData.map(d => {
        const pct = d.count / modelTotal * 100;
        const dash = circ * pct / 100;
        const gap = circ - dash;
        const o = -circ * offset / 100;
        offset += pct;
        return `<circle r="${r}" cx="50" cy="50" fill="none" stroke="${d.color}" stroke-width="${sw}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${o}" stroke-linecap="round"/>`;
      }).join("");

      const legend = modelData.map(d => {
        const pct = modelTotal > 0 ? Math.round(d.count / modelTotal * 100) : 0;
        return `<div style="display:flex;align-items:center;gap:5px">
          <div style="width:8px;height:8px;border-radius:2px;background:${d.color}"></div>
          <span style="font-size:10px;color:${C.textDim};font-family:monospace">${d.label} <span style="color:${C.text};font-weight:700">${d.count}</span> <span style="color:${C.textMuted}">(${pct}%)</span></span>
        </div>`;
      }).join("");

      parts.push(`<div style="${cardStyle}">
        ${sectionLabel("Model Routing Distribution")}
        <div style="display:flex;align-items:center;justify-content:center;gap:16px">
          <svg viewBox="0 0 100 100" width="80" height="80">
            ${slices}
            <text x="50" y="47" text-anchor="middle" fill="${C.text}" font-size="14" font-weight="800" font-family="monospace">${modelTotal}</text>
            <text x="50" y="58" text-anchor="middle" fill="${C.textDim}" font-size="7" font-weight="600">TASKS</text>
          </svg>
          <div style="display:flex;flex-direction:column;gap:5px">${legend}</div>
        </div>
      </div>`);
    }

    // Gate Score History (actual per-gate scores)
    if (gateScores.length > 0) {
      const lastScores = gateScores.slice(-10);
      const scoreBars = lastScores.map((s, i) => {
        const pct = Math.min(100, s * 10); // 0-10 → 0-100%
        const color = s > 6 ? C.green : s > 3 ? C.accent : C.red;
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-size:7px;color:${C.textDim};font-family:monospace">${s}</span>
          <div style="width:14px;height:40px;background:${C.border};border-radius:3px;display:flex;align-items:flex-end;overflow:hidden">
            <div style="width:100%;height:${pct}%;background:${color};border-radius:0 0 3px 3px"></div>
          </div>
        </div>`;
      }).join("");

      parts.push(`<div style="${cardStyle}">
        ${sectionLabel(`Gate Scores — Last ${lastScores.length}`)}
        <div style="display:flex;gap:3px;justify-content:center">${scoreBars}</div>
        <div style="display:flex;justify-content:center;gap:12px;margin-top:6px">
          <span style="font-size:8px;color:${C.green}">● Ready (&gt;6)</span>
          <span style="font-size:8px;color:${C.accent}">● Needs Info (4-6)</span>
          <span style="font-size:8px;color:${C.red}">● Blocked (≤3)</span>
        </div>
      </div>`);
    }

    // ══════════════════════════════════════════════
    // ROW 3 — FPCR Trend + Operational
    // ══════════════════════════════════════════════

    // FPCR Trend Line
    if (weeklyFpcr.length >= 2) {
      const w = 200, h = 50;
      const max = Math.max(...weeklyFpcr, 100);
      const min = Math.min(...weeklyFpcr, 0);
      const range = max - min || 1;
      const step = w / (weeklyFpcr.length - 1);
      const pts = weeklyFpcr.map((v, i) => ({ x: i * step, y: h - ((v - min) / range) * (h - 10) }));
      const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      const areaD = `${pathD} L ${pts[pts.length - 1].x} ${h} L 0 ${h} Z`;
      const dots = pts.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${C.green}"/><text x="${p.x}" y="${p.y - 7}" text-anchor="middle" fill="${C.green}" font-size="7" font-weight="700" font-family="monospace">${weeklyFpcr[i]}%</text>`).join("");
      const labels = weeklyFpcr.map((_, i) => `<span style="font-size:7px;color:${C.textMuted};font-family:monospace">W${i + 1}</span>`).join("");

      parts.push(`<div style="${cardStyle}">
        ${sectionLabel("FPCR Trend — Weekly")}
        <svg viewBox="0 0 ${w} ${h}" style="width:100%">
          <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${C.green}" stop-opacity="0.3"/><stop offset="100%" stop-color="${C.green}" stop-opacity="0"/></linearGradient></defs>
          <path d="${areaD}" fill="url(#tg)"/>
          <path d="${pathD}" fill="none" stroke="${C.green}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          ${dots}
        </svg>
        <div style="display:flex;justify-content:space-between;margin-top:4px">${labels}</div>
      </div>`);
    }

    // Operational Stats
    const opStats = [
      { val: total > 0 ? Math.round(avgDuration / 1000) : 0, unit: "s", label: "Avg Duration" },
      { val: totalLearnings, unit: "", label: "Learnings" },
      { val: totalFiles, unit: "", label: "Files Changed" },
      { val: kFiles, unit: "", label: "Knowledge Files" },
    ];
    if (totalCost > 0) opStats.push({ val: Number(totalCost.toFixed(4)), unit: "$", label: "Total Cost" });

    const opGrid = opStats.map(s => `<div style="text-align:center">
      <div style="font-size:18px;font-weight:800;color:${C.text};font-family:monospace">${s.val}${s.unit ? `<span style="font-size:10px;color:${C.textDim}">${s.unit}</span>` : ""}</div>
      <div style="font-size:7px;color:${C.textDim};text-transform:uppercase;letter-spacing:1px;margin-top:2px">${s.label}</div>
    </div>`).join("");

    parts.push(`<div style="${cardStyle}">
      ${sectionLabel("Operational")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${opGrid}</div>
    </div>`);

    // ══════════════════════════════════════════════
    // ROW 4 — History Table
    // ══════════════════════════════════════════════
    if (total > 0) {
      const last8 = records.slice(-8);
      const tierColor = (t: string) => {
        const lc = String(t || "").toLowerCase();
        if (lc === "high" || lc.includes("opus")) return C.purple;
        if (lc === "mid" || lc.includes("sonnet")) return C.blue;
        return C.teal;
      };
      const tierLabel = (t: string) => {
        const lc = String(t || "").toLowerCase();
        if (lc === "high" || lc.includes("opus")) return "opus";
        if (lc === "mid" || lc.includes("sonnet")) return "sonnet";
        return "haiku";
      };
      const rows = last8.map((r: any, i: number) => {
        const p = isPassed(r);
        const rounds = getRounds(r);
        const dur = r.durationMs ? Math.round(r.durationMs / 1000) : 0;
        const idx = total - last8.length + i + 1;
        const scoreMatch = logLines.find(l => l.includes("steer.gate.done") && l.includes(r.taskId));
        let score = "—";
        if (scoreMatch) { const m = scoreMatch.match(/score=(\d+)/); if (m) score = String(Math.min(10, Number(m[1]))); }
        return `<tr style="border-bottom:1px solid ${C.bgAlt}">
          <td style="padding:4px 6px;color:${C.textMuted}">${idx}</td>
          <td style="padding:4px 6px"><span style="color:${p ? C.green : C.red};font-weight:700">${p ? "PASS" : "FAIL"}</span></td>
          <td style="padding:4px 6px;color:${rounds > 1 ? C.accent : C.textDim}">${rounds}</td>
          <td style="padding:4px 6px;color:${tierColor(r.modelTier)}">${tierLabel(r.modelTier)}</td>
          <td style="padding:4px 6px;color:${C.textDim}">${score}</td>
          <td style="padding:4px 6px;color:${C.textDim}">${r.files?.length || 0}</td>
          <td style="padding:4px 6px;color:${r.learnings > 0 ? C.green : C.textMuted}">${r.learnings || "—"}</td>
          <td style="padding:4px 6px;color:${C.textDim}">${dur}s</td>
        </tr>`;
      }).join("");

      parts.push(`<div style="${cardStyle}">
        ${sectionLabel("History — Per Task Telemetry")}
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:9px;font-family:monospace">
            <thead><tr style="border-bottom:1px solid ${C.border}">
              ${["#", "FPCR", "Rnd", "Model", "Score", "Files", "Learn", "Time"].map(h => `<th style="padding:4px 6px;color:${C.textDim};font-weight:700;text-align:left;font-size:7px;letter-spacing:1px">${h}</th>`).join("")}
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`);
    }

    if (total === 0) {
      parts.push(this.emptyState("No completed tasks yet. Run /steer to start building metrics."));
    }

    return parts.join("");
  }

  private bigMetricCard(title: string, value: string, unit: string, label: string, color: string, sublabel: string): string {
    return `<div style="padding:10px;border-radius:10px;background:${C.surface};border:1px solid ${C.border}">
      <div style="font-size:7px;font-weight:700;color:${C.textDim};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-family:monospace">${this.esc(title)}</div>
      <div style="text-align:center">
        <div style="display:flex;align-items:baseline;justify-content:center;gap:2px">
          <span style="font-size:28px;font-weight:800;color:${color};font-family:monospace;line-height:1">${value}</span>
          ${unit ? `<span style="font-size:12px;font-weight:600;color:${color}88">${unit}</span>` : ""}
        </div>
        <div style="font-size:9px;color:${C.textDim};margin-top:3px;font-weight:600;text-transform:uppercase;letter-spacing:1px">${label}</div>
        <div style="font-size:8px;color:${C.textMuted};margin-top:2px">${sublabel}</div>
      </div>
    </div>`;
  }

  private metricCard(label: string, value: string, unit: string, color: string): string {
    return `<div class="metric-card">
      <div class="metric-label">${label}</div>
      <div style="display:flex;align-items:baseline;gap:4px">
        <span class="metric-value" style="color:${color}">${value}</span>
        ${unit ? `<span class="metric-unit">${unit}</span>` : ""}
      </div>
    </div>`;
  }

  // ═══════════════════════════════════════════════
  // ─── RULES TAB ────────────────────────────────
  // ═══════════════════════════════════════════════
  private renderRulesTab(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return this.emptyState("No workspace open");

    const parts: string[] = [];

    // Parse RULES.md into individual rules
    const rulesPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "RULES.md").fsPath;
    try {
      const content = fs.readFileSync(rulesPath, "utf-8");
      parts.push(`<div class="section-title">Active Rules — RULES.md</div>`);

      const lines = content.split("\n").filter((l) => l.trim().startsWith("- ") || l.trim().startsWith("* "));
      if (lines.length > 0) {
        lines.forEach((line, i) => {
          const text = line.replace(/^[\s\-\*]+/, "").trim();
          const severity = text.toLowerCase().includes("never") || text.toLowerCase().includes("must") ? "BLOCK" :
            text.toLowerCase().includes("should") || text.toLowerCase().includes("prefer") ? "WARN" : "AUTO";
          const sevColor = severity === "BLOCK" ? C.red : severity === "WARN" ? C.accent : C.teal;

          parts.push(`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;background:${C.surface};border:1px solid ${C.border};margin-bottom:4px">
            <span style="font-size:9px;font-weight:700;color:${C.textDim};font-family:monospace">R${i + 1}</span>
            <span style="font-size:11px;color:${C.text};flex:1">${this.esc(text)}</span>
            ${this.pill(severity, sevColor, true)}
          </div>`);
        });
      } else {
        // Fallback: show as formatted block
        parts.push(`<div class="card"><pre style="font-size:11px;white-space:pre-wrap;word-break:break-word;color:${C.text};margin:0">${this.esc(content)}</pre></div>`);
      }
    } catch {
      parts.push(this.emptyState("No RULES.md found. Run steer.init to create one."));
    }

    // Hooks
    const hooksPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "hooks.yaml").fsPath;
    try {
      const content = fs.readFileSync(hooksPath, "utf-8");
      parts.push(`<div class="section-title" style="margin-top:8px">Hooks</div>`);

      // Parse YAML hooks (simple key: value lines)
      const hookLines = content.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
      for (const line of hookLines) {
        const match = line.match(/^\s*(\S+):\s*(.+)/);
        if (match) {
          const [, hookName, action] = match;
          parts.push(`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;background:${C.bgAlt};margin-bottom:3px">
            <span style="font-size:8px;font-weight:600;color:${C.teal};font-family:monospace;padding:1px 4px;background:${C.teal}18;border-radius:3px">${this.esc(hookName)}</span>
            <span style="font-size:10px;color:${C.textDim};flex:1">${this.esc(action)}</span>
            <div style="width:6px;height:6px;border-radius:50%;background:${C.green}"></div>
          </div>`);
        }
      }
    } catch {
      // hooks.yaml may not exist
    }

    // Governance footer
    parts.push(`<div style="margin-top:auto;padding:10px 12px;border-radius:8px;background:${C.surface};border:1px solid ${C.accent}33">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="color:${C.accent}">${ICONS.shield}</span>
        <span style="font-size:11px;font-weight:600;color:${C.accent}">Governance Active</span>
      </div>
      <p style="font-size:10px;color:${C.textDim};margin:0">
        Deterministic scoring · File-based state · All tasks logged
      </p>
    </div>`);

    return parts.join("");
  }

  // ═══════════════════════════════════════════════
  // ─── MAP / CODEMAP TAB ───────────────────────
  // ═══════════════════════════════════════════════
  private renderMapTab(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return this.emptyState("No workspace open");

    const parts: string[] = [];
    parts.push(`<div class="section-title">Codebase Intelligence</div>`);

    const mapPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "codebase-map.json").fsPath;
    try {
      const map = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
      const modules = Object.values(map.modules || {}) as any[];
      const totalFiles = Object.keys(map.files || {}).length;
      const totalDeps = Object.values(map.dependencies || {}).reduce((s: number, d: any) => s + (d.imports?.length || 0), 0);

      // Summary card
      parts.push(`<div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:10px;font-weight:600;color:${C.text}">Codebase Map</span>
          ${this.pill("INDEXED", C.green, true)}
        </div>
        <div style="display:flex;gap:12px;font-size:9px;color:${C.textDim}">
          <span>${totalFiles} files</span>
          <span>·</span>
          <span>${totalDeps} deps</span>
          <span>·</span>
          <span>${modules.length} modules</span>
        </div>
      </div>`);

      // Module tree
      parts.push(`<div class="card" style="flex:1;font-family:'JetBrains Mono','Fira Code',monospace">
        <div class="section-title" style="margin-bottom:6px;font-family:inherit">Module Map</div>
        ${modules.map((m: any) => {
      const fileCount = (m.files || []).length;
      const depCount = (m.files || []).reduce((s: number, f: string) => {
        const d = map.dependencies?.[f];
        return s + (d?.imports?.length || 0);
      }, 0);
      const risk = m.critical ? "high" : depCount > 20 ? "med" : "low";
      const riskColor = risk === "high" ? C.red : risk === "med" ? C.accent : C.green;

      const isExpanded = this._expandedModules.has(m.name);
      const displayFiles = isExpanded ? (m.files || []) : (m.files || []).slice(0, 5);
      const fileItems = displayFiles.map((f: string) =>
        `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;padding-left:16px;font-size:10px;color:${C.textDim}">
              <span style="color:${C.textMuted};font-size:8px;width:10px">└</span>
              <span style="flex:1">${path.basename(f)}</span>
            </div>`
      ).join("");
      const moreFiles = fileCount > 5
        ? `<div onclick="vscode.postMessage({type:'expandModule',module:'${this.esc(m.name)}'})" style="padding-left:26px;font-size:9px;color:${C.accent};cursor:pointer;user-select:none">${isExpanded ? "▲ show less" : `+${fileCount - 5} more ▼`}</div>`
        : "";

      return `<div style="margin-bottom:4px">
            <div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:10px;color:${C.text}">
              <span style="color:${C.textMuted};font-size:8px;width:10px">▶</span>
              <span style="flex:1">${this.esc(m.name)}/</span>
              <span style="font-size:8px;color:${C.textDim}">${fileCount}f</span>
              ${this.pill(risk.toUpperCase(), riskColor, true)}
            </div>
            ${fileItems}${moreFiles}
          </div>`;
    }).join("")}
      </div>`);

      // Rebuild button
      parts.push(`<div style="text-align:center;margin-top:4px">
        <button onclick="runCommand('steeragent.rebuildMap')" style="padding:6px 12px;border-radius:4px;background:${C.surface};border:1px solid ${C.border};color:${C.textDim};font-size:10px;cursor:pointer;font-family:inherit">Rebuild Map</button>
      </div>`);

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      parts.push(`<div class="card" style="text-align:center;padding:20px">
        <div style="color:${C.textDim};margin-bottom:8px">${ICONS.layers}</div>
        <div style="font-size:11px;font-weight:600;color:${C.text}">No codebase map</div>
        <div style="font-size:10px;color:${C.textDim};margin:6px 0">Run steer.map to generate the codebase index</div>
        <div style="font-size:9px;color:${C.red};margin:4px 0;word-break:break-all">${this.esc(errMsg)}</div>
        <button onclick="runCommand('steeragent.rebuildMap')" style="margin-top:8px;padding:6px 12px;border-radius:4px;background:${C.accent};border:none;color:${C.bgAlt};font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">
          ${ICONS.play} Build Map
        </button>
      </div>`);
    }

    return parts.join("");
  }

  // ═══════════════════════════════════════════════
  // ─── LOG TAB ─────────────────────────────────
  // ═══════════════════════════════════════════════
  private renderLogTab(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return this.emptyState("No workspace open");

    const logPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "state", "steer.log").fsPath;

    let lines: string[] = [];
    try {
      const content = fs.readFileSync(logPath, "utf-8");
      lines = content.split("\n").filter(Boolean);
    } catch {
      return this.emptyState("No logs yet. Run a steer workflow to generate logs.");
    }

    if (lines.length === 0) {
      return this.emptyState("Log file is empty. Start a steer workflow.");
    }

    // Show most recent entries first, limit to 100
    const recent = lines.slice(-100).reverse();

    const parts: string[] = [];
    parts.push(`<div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
      <span>Workflow Log</span>
      <span style="font-size:9px;color:${C.textDim};text-transform:none;letter-spacing:normal">${lines.length} entries</span>
    </div>`);

    for (const line of recent) {
      // Parse: [2026-03-08T10:30:00.000Z] TOOL steer.start(taskId=task_123, mode=dev)
      const match = line.match(/^\[([^\]]+)\]\s+(.*)$/);
      if (!match) continue;

      const timestamp = match[1];
      const message = match[2];

      // Determine entry type and color
      let color = C.textDim;
      let icon = ICONS.code;
      let label = "LOG";

      if (message.startsWith("TOOL steer.gate")) {
        color = C.purple;
        icon = ICONS.shield;
        label = "GATE";
      } else if (message.startsWith("TOOL steer.start")) {
        color = C.green;
        icon = ICONS.play;
        label = "START";
      } else if (message.startsWith("TOOL steer.plan")) {
        color = C.blue;
        icon = ICONS.brain;
        label = "PLAN";
      } else if (message.startsWith("TOOL steer.execute")) {
        color = C.accent;
        icon = ICONS.bolt;
        label = "EXEC";
      } else if (message.startsWith("TOOL steer.verify")) {
        color = C.teal;
        icon = ICONS.check;
        label = "VERIFY";
      } else if (message.startsWith("TOOL steer.learn")) {
        color = C.yellow;
        icon = ICONS.brain;
        label = "LEARN";
      } else if (message.startsWith("TOOL steer.run")) {
        color = C.accent;
        icon = ICONS.bolt;
        label = "RUN";
      }

      // Extract key-value pairs from the tool call args
      const argsMatch = message.match(/\(([^)]*)\)$/);
      const argsStr = argsMatch ? argsMatch[1] : "";
      const isDoneEntry = message.includes(".done(");

      // Format time
      let timeStr = "";
      try {
        const d = new Date(timestamp);
        timeStr = d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      } catch {
        timeStr = timestamp.slice(11, 19);
      }

      // Highlight key metrics from .done entries
      let metricsHtml = "";
      if (isDoneEntry && argsStr) {
        const metrics: string[] = [];
        const scoreMatch = argsStr.match(/score=(\d+)/);
        const statusMatch = argsStr.match(/status=(\w+)/);
        const costMatch = argsStr.match(/cost=([\d.]+)/);
        const modelMatch = argsStr.match(/model=(\w+)/);
        const passedMatch = argsStr.match(/passed=(true|false)/);
        const learningsMatch = argsStr.match(/learnings=(\d+)/);
        const fpcrMatch = argsStr.match(/fpcr=(true|false)/);
        const durationMatch = argsStr.match(/durationMs=(\d+)/);
        const stepsMatch = argsStr.match(/planSteps=(\d+)/);
        const responseMatch = argsStr.match(/responseChars=(\d+)/);

        if (scoreMatch) metrics.push(`<span style="color:${C.accent}">score:${scoreMatch[1]}/10</span>`);
        if (statusMatch) {
          const sc = statusMatch[1] === "READY" ? C.green : statusMatch[1] === "BLOCKED" ? C.red : C.yellow;
          metrics.push(`<span style="color:${sc}">${statusMatch[1]}</span>`);
        }
        if (modelMatch) metrics.push(`<span style="color:${C.blue}">model:${modelMatch[1]}</span>`);
        if (costMatch) metrics.push(`<span style="color:${C.teal}">$${parseFloat(costMatch[1]).toFixed(4)}</span>`);
        if (passedMatch) {
          const pc = passedMatch[1] === "true" ? C.green : C.red;
          metrics.push(`<span style="color:${pc}">${passedMatch[1] === "true" ? "PASS" : "FAIL"}</span>`);
        }
        if (stepsMatch) metrics.push(`<span style="color:${C.blue}">${stepsMatch[1]} steps</span>`);
        if (learningsMatch) metrics.push(`<span style="color:${C.yellow}">${learningsMatch[1]} learnings</span>`);
        if (fpcrMatch) {
          const fc = fpcrMatch[1] === "true" ? C.green : C.red;
          metrics.push(`<span style="color:${fc}">FPCR:${fpcrMatch[1]}</span>`);
        }
        if (durationMatch) {
          const ms = parseInt(durationMatch[1]);
          const sec = (ms / 1000).toFixed(1);
          metrics.push(`<span style="color:${C.textDim}">${sec}s</span>`);
        }
        if (responseMatch) metrics.push(`<span style="color:${C.textDim}">${responseMatch[1]}ch</span>`);

        if (metrics.length > 0) {
          metricsHtml = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:3px;font-size:9px">${metrics.join("")}</div>`;
        }
      }

      const toolName = isDoneEntry ? label + " done" : label;

      parts.push(`<div style="padding:6px 8px;border-radius:6px;background:${C.surface};border:1px solid ${C.border};border-left:2px solid ${color}">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="color:${color}">${icon}</span>
          <span style="font-size:10px;font-weight:600;color:${color}">${toolName}</span>
          <span style="font-size:9px;color:${C.textDim};margin-left:auto;font-variant-numeric:tabular-nums">${timeStr}</span>
        </div>
        ${argsStr ? `<div style="font-size:9px;color:${C.textDim};margin-top:2px;word-break:break-all">${this.esc(argsStr)}</div>` : ""}
        ${metricsHtml}
      </div>`);
    }

    return parts.join("");
  }

  // ─── Empty State Helper ────────────────────────
  private emptyState(message: string): string {
    return `<div class="card" style="text-align:center;padding:20px">
      <div style="font-size:11px;color:${C.textDim}">${message}</div>
    </div>`;
  }

  dispose(): void {
    for (const w of this._watchers) w.dispose();
    this._watchers = [];
    this._sessionDisposable?.dispose();
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    if (this._pollTimer) clearInterval(this._pollTimer);
  }
}
