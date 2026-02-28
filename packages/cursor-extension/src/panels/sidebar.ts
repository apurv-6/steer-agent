import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import type { SessionState } from "../SessionState";

export type SidebarTab = "task" | "knowledge" | "fpcr" | "map" | "rules";

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

    // Subscribe to SessionState changes
    if (this._sessionState) {
      this._sessionDisposable = this._sessionState.onDidChange(() => this.debouncedRefresh());
    }

    this.loadTaskState();
    this.refresh();
  }

  private loadTaskState(): void {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return;
    const taskPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "state", "current-task.json").fsPath;
    try {
      this._taskData = JSON.parse(fs.readFileSync(taskPath, "utf-8"));
    } catch {
      this._taskData = null;
    }
    this.refresh();
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
      const passed = records.filter((r: any) => r.firstPassComplete === true || r.resolution === "passed");
      return ((passed.length / records.length) * 100).toFixed(1);
    } catch {
      return "—";
    }
  }

  private getModelLabel(tier: string): string {
    const map: Record<string, string> = { high: "Opus 4", mid: "Sonnet 4", small: "Haiku 4" };
    return map[tier.toLowerCase()] || tier;
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
    const m: Record<string, { label: string; color: string; desc: string }> = {
      high: { label: "Opus 4", color: C.purple, desc: "Critical / Complex" },
      mid: { label: "Sonnet 4", color: C.blue, desc: "Standard Tasks" },
      small: { label: "Haiku 4", color: C.teal, desc: "Quick / Simple" },
    };
    const cfg = (tier ? m[tier.toLowerCase()] : null) || { label: "Not set", color: C.textDim, desc: "Pending" };
    const desc = reason ? this.esc(reason) : cfg.desc;
    return `<div style="display:flex;align-items:center;gap:6px">
      <div style="width:8px;height:8px;border-radius:50%;background:${cfg.color};box-shadow:0 0 6px ${cfg.color}66"></div>
      <span style="font-size:11px;font-weight:600;color:${cfg.color}">${cfg.label}</span>
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
    const modelTier = t.modelTier || sessionData?.lastModelTier || null;

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
        ${this.modelTag(modelTier, t.modelReason)}
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
    const subAgents = t.subAgents || [];
    const subAgentSection = `<div class="card">
      <div class="section-title" style="margin-bottom:6px">Sub-Agents (Parallel)</div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${subAgents.length > 0 ? subAgents.map((a: any) => `<div style="display:flex;align-items:center;gap:6px">
          <div style="width:6px;height:6px;border-radius:50%;background:${a.status === "running" ? C.green : C.textDim};animation:${a.status === "running" ? "pulse 2s infinite" : "none"}"></div>
          <span style="font-size:10px;color:${C.text};flex:1">${this.esc(a.name || "Agent")}</span>
          <span style="font-size:9px;color:${a.status === "running" ? C.green : C.textDim}">${a.status || "idle"}</span>
        </div>`).join("") : `<div style="font-size:10px;color:${C.textDim}">No sub-agents active</div>`}
      </div>
    </div>`;

    // ─── Task Input ───
    const taskInput = `<div style="padding:8px 10px;border-radius:8px;background:${C.bgAlt};border:1px solid ${C.border};margin-top:auto">
      <div style="display:flex;gap:6px">
        <input placeholder="Describe task or paste Jira ID..."
          style="flex:1;padding:6px 8px;border-radius:4px;background:${C.surface};border:1px solid ${C.border};color:${C.text};font-size:11px;outline:none;font-family:inherit" readonly />
        <button onclick="runCommand('steeragent.newTask')" title="Reset to a fresh task" style="padding:6px 8px;border-radius:4px;background:${C.surface};border:1px solid ${C.border};color:${C.textDim};font-size:10px;font-weight:600;cursor:pointer;font-family:inherit">↺</button>
        <button onclick="runCommand('steeragent.startTask')" style="padding:6px 10px;border-radius:4px;background:${C.accent};border:none;color:${C.bgAlt};font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:inherit">
          ${ICONS.play} STEER
        </button>
      </div>
    </div>`;

    return [header, clearSection, workflow, subAgentSection, taskInput].filter(Boolean).join("");
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

    const historyPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "state", "history.jsonl").fsPath;
    let records: any[] = [];
    try {
      const raw = fs.readFileSync(historyPath, "utf-8");
      records = raw.trim().split("\n").filter(Boolean).map((l: string) => JSON.parse(l));
    } catch {
      // No history yet
    }

    const totalTasks = records.length;
    const fpcrTasks = records.filter((r: any) => r.firstPassComplete === true || r.resolution === "passed");
    const fpcr = totalTasks > 0 ? ((fpcrTasks.length / totalTasks) * 100).toFixed(1) : "—";
    const avgRounds = totalTasks > 0 ? (records.reduce((s: number, r: any) => s + (r.rounds ?? r.round ?? 1), 0) / totalTasks).toFixed(1) : "—";

    let kFiles = 0;
    try {
      const dir = vscode.Uri.joinPath(folders[0].uri, ".steer", "knowledge").fsPath;
      kFiles = fs.readdirSync(dir).filter((f: string) => f.endsWith(".md")).length;
    } catch {}

    const parts: string[] = [];

    parts.push(`<div class="section-title">FPCR Telemetry</div>`);

    // Metric cards row 1
    parts.push(`<div style="display:flex;gap:6px">
      ${this.metricCard("First-Pass Rate", fpcr === "—" ? "—" : fpcr, "%", C.green)}
      ${this.metricCard("Avg Rounds", avgRounds, "", C.blue)}
    </div>`);

    // Metric cards row 2
    parts.push(`<div style="display:flex;gap:6px">
      ${this.metricCard("Tasks Done", String(totalTasks), "", C.accent)}
      ${this.metricCard("Knowledge Files", String(kFiles), "", C.purple)}
    </div>`);

    // Bar chart (last 20)
    if (records.length > 0) {
      const last20 = records.slice(-20);
      const getRounds = (r: any) => r.rounds ?? r.round ?? 1;
      const maxRound = Math.max(...last20.map((r: any) => getRounds(r)), 1);

      const bars = last20.map((r: any) => {
        const h = Math.max(10, (getRounds(r) / maxRound) * 100);
        const passed = r.firstPassComplete === true || r.resolution === "passed";
        const color = passed ? C.green : C.red;
        const result = passed ? "pass" : "fail";
        return `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%">
          <div style="width:100%;border-radius:2px;height:${h}%;background:${color};transition:height 0.4s" title="${r.taskId}: ${getRounds(r)} rounds, ${result}"></div>
        </div>`;
      }).join("");

      parts.push(`<div class="card">
        <div class="section-title" style="margin-bottom:8px">Last ${last20.length} Tasks</div>
        <div style="display:flex;align-items:flex-end;gap:2px;height:60px">${bars}</div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:9px">
          <span style="color:${C.green}">● pass</span>
          <span style="color:${C.red}">● fail</span>
        </div>
      </div>`);
    }

    // Model routing
    const sessionData = this._sessionState?.data;
    if (sessionData) {
      parts.push(`<div class="card">
        <div class="section-title" style="margin-bottom:6px">Model Routing</div>
        <div style="display:flex;gap:2px;height:8px;border-radius:4px;overflow:hidden">
          <div style="width:15%;background:${C.purple}" title="Opus 15%"></div>
          <div style="width:60%;background:${C.blue}" title="Sonnet 60%"></div>
          <div style="width:25%;background:${C.teal}" title="Haiku 25%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-size:8px;color:${C.purple}">● Opus</span>
          <span style="font-size:8px;color:${C.blue}">● Sonnet</span>
          <span style="font-size:8px;color:${C.teal}">● Haiku</span>
        </div>
      </div>`);
    }

    if (totalTasks === 0) {
      parts.push(this.emptyState("No completed tasks yet. Complete tasks with steer.verify to start building FPCR metrics."));
    }

    return parts.join("");
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

    } catch {
      parts.push(`<div class="card" style="text-align:center;padding:20px">
        <div style="color:${C.textDim};margin-bottom:8px">${ICONS.layers}</div>
        <div style="font-size:11px;font-weight:600;color:${C.text}">No codebase map</div>
        <div style="font-size:10px;color:${C.textDim};margin:6px 0">Run steer.map to generate the codebase index</div>
        <button onclick="runCommand('steeragent.rebuildMap')" style="margin-top:8px;padding:6px 12px;border-radius:4px;background:${C.accent};border:none;color:${C.bgAlt};font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">
          ${ICONS.play} Build Map
        </button>
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
  }
}
