/**
 * Minimal vscode mock for vitest unit tests.
 * Only mocks what the extension's pure-logic modules actually import.
 */

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  readonly event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };

  fire(data: T): void {
    for (const l of this.listeners) l(data);
  }

  dispose(): void {
    this.listeners = [];
  }
}

export const Uri = {
  joinPath: (..._args: unknown[]) => ({ fsPath: "" }),
};

export const window = {
  showInformationMessage: () => Promise.resolve(undefined),
  showWarningMessage: () => Promise.resolve(undefined),
  showErrorMessage: () => Promise.resolve(undefined),
  showInputBox: () => Promise.resolve(undefined),
  showQuickPick: () => Promise.resolve(undefined),
  registerWebviewViewProvider: () => ({ dispose: () => {} }),
};

export const commands = {
  registerCommand: (_id: string, _cb: unknown) => ({ dispose: () => {} }),
  executeCommand: () => Promise.resolve(undefined),
};

export const workspace = {
  workspaceFolders: undefined,
  createFileSystemWatcher: () => ({
    onDidChange: () => ({ dispose: () => {} }),
    onDidCreate: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
};

export const languages = {
  createDiagnosticCollection: () => ({
    clear: () => {},
    set: () => {},
    get: () => [],
    dispose: () => {},
  }),
};

export const chat = {
  createChatParticipant: (_id: string, _handler: unknown) => ({
    iconPath: undefined,
    dispose: () => {},
  }),
};

export const env = {
  clipboard: {
    writeText: () => Promise.resolve(),
  },
};

export class Diagnostic {
  constructor(
    public range: Range,
    public message: string,
    public severity: number,
  ) {}
  source?: string;
}

export class Range {
  constructor(
    public startLine: number,
    public startChar: number,
    public endLine: number,
    public endChar: number,
  ) {}
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export interface Memento {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void>;
  keys(): readonly string[];
}
