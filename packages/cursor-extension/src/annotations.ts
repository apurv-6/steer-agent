import * as vscode from "vscode";
import * as fs from "node:fs";

const diagnosticCollection = vscode.languages.createDiagnosticCollection("steer");

/**
 * Watch codebase map and knowledge files to provide inline annotations.
 * Shows diagnostics on files that have known gotchas or conventions.
 */
export function registerAnnotations(context: vscode.ExtensionContext): void {
  // Watch for knowledge updates
  const knowledgeWatcher = vscode.workspace.createFileSystemWatcher("**/.steer/knowledge/*.md");
  knowledgeWatcher.onDidChange(() => refreshAnnotations());
  knowledgeWatcher.onDidCreate(() => refreshAnnotations());
  context.subscriptions.push(knowledgeWatcher, diagnosticCollection);

  // Watch current task for risk annotations
  const taskWatcher = vscode.workspace.createFileSystemWatcher("**/.steer/state/current-task.json");
  taskWatcher.onDidChange(() => refreshTaskAnnotations());
  taskWatcher.onDidCreate(() => refreshTaskAnnotations());
  context.subscriptions.push(taskWatcher);

  // Initial refresh
  refreshAnnotations();
}

function refreshAnnotations(): void {
  diagnosticCollection.clear();

  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return;

  const knowledgeDir = vscode.Uri.joinPath(folders[0].uri, ".steer", "knowledge").fsPath;
  try {
    const files = fs.readdirSync(knowledgeDir).filter((f: string) => f.endsWith(".md"));
    for (const file of files) {
      const content = fs.readFileSync(`${knowledgeDir}/${file}`, "utf-8");
      // Extract gotchas and show as information diagnostics
      const gotchaMatches = content.matchAll(/### \[gotcha\] (.+)/g);
      for (const match of gotchaMatches) {
        // Show as notification toast
        vscode.window.showInformationMessage(`[Steer Knowledge] ${match[1]}`);
      }
    }
  } catch {
    // Best effort
  }
}

function refreshTaskAnnotations(): void {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return;

  const taskPath = vscode.Uri.joinPath(folders[0].uri, ".steer", "state", "current-task.json").fsPath;
  try {
    const task = JSON.parse(fs.readFileSync(taskPath, "utf-8"));

    // Add diagnostics for high-risk plan steps
    if (task.planSteps) {
      for (const step of task.planSteps) {
        if (step.risk === "high") {
          for (const file of step.files) {
            const uri = vscode.Uri.joinPath(folders[0].uri, file);
            const diag = new vscode.Diagnostic(
              new vscode.Range(0, 0, 0, 0),
              `[Steer] High-risk change: ${step.description}`,
              vscode.DiagnosticSeverity.Warning,
            );
            diag.source = "steer";
            const existing = diagnosticCollection.get(uri) || [];
            diagnosticCollection.set(uri, [...existing, diag]);
          }
        }
      }
    }
  } catch {
    // Best effort
  }
}
