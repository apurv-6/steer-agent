import * as vscode from "vscode";

export type GateMode = "dev" | "debug" | "bugfix" | "design" | "refactor";

export interface SessionStateData {
  steerEnabled: boolean;
  mode: GateMode;
  blockThreshold: number;
  lastModelTier: string | null;
  lastPatchedPrompt: string | null;
  taskId: string | null;
  turnId: number;
  gateCallCount: number;
  lastScore: number | null;
  scoreTrend: number[];  // last N scores for trend display
  lastStatus: string | null;
}

const DEFAULT_STATE: SessionStateData = {
  steerEnabled: false,
  mode: "dev",
  blockThreshold: 3,
  lastModelTier: null,
  lastPatchedPrompt: null,
  taskId: null,
  turnId: 0,
  gateCallCount: 0,
  lastScore: null,
  scoreTrend: [],
  lastStatus: null,
};

const STORAGE_KEY = "steeragent.sessionState";

export class SessionState {
  private _state: SessionStateData;
  private readonly _onDidChange = new vscode.EventEmitter<SessionStateData>();
  readonly onDidChange = this._onDidChange.event;
  private readonly _memento: vscode.Memento | undefined;

  constructor(memento?: vscode.Memento) {
    this._memento = memento;
    const stored = memento?.get<SessionStateData>(STORAGE_KEY);
    this._state = stored ? { ...DEFAULT_STATE, ...stored } : { ...DEFAULT_STATE };
  }

  get data(): Readonly<SessionStateData> {
    return this._state;
  }

  update(partial: Partial<SessionStateData>): void {
    this._state = { ...this._state, ...partial };

    // Auto-track score trend
    if (partial.lastScore !== undefined && partial.lastScore !== null) {
      const trend = [...this._state.scoreTrend, partial.lastScore].slice(-10);
      this._state.scoreTrend = trend;
    }

    this._onDidChange.fire(this._state);
    this._memento?.update(STORAGE_KEY, this._state);
  }

  reset(): void {
    this._state = { ...DEFAULT_STATE };
    this._onDidChange.fire(this._state);
    this._memento?.update(STORAGE_KEY, this._state);
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
