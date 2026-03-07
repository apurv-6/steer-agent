import * as vscode from "vscode";
import { startTask as coreStartTask, buildCodebaseMap } from "@steer-agent-tool/core";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Bridge between VS Code commands and MCP server.
 * Shells out to the CLI or MCP tools.
 */
export function registerBridgeCommands(context: vscode.ExtensionContext): void {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  context.subscriptions.push(
    vscode.commands.registerCommand("steeragent.startTask", async (prefillGoal?: string) => {
      let goal = prefillGoal?.trim();
      if (!goal) {
        goal = await vscode.window.showInputBox({
          prompt: "Task goal",
          placeHolder: "What are you working on?",
        });
      }
      if (!goal) return;

      const modes = ["bugfix", "feature", "refactor", "debug", "design"];
      const mode = await vscode.window.showQuickPick(modes, {
        placeHolder: "Select task mode",
      });
      if (!mode) return;

      const taskId = `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      try {
        vscode.window.showInformationMessage(`Starting task: ${goal} (${mode})...`);
        const result = await coreStartTask({
          cwd,
          mode: mode as any,
          taskId,
          initialMessage: goal,
        });
        vscode.window.showInformationMessage(
          `Task started: ${result.state.taskId} — ${result.message}`,
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to start task: ${err.message}`);
      }
    }),

    vscode.commands.registerCommand("steeragent.showStatus", () => {
      vscode.commands.executeCommand("steeragent.sidebar.focus");
    }),

    vscode.commands.registerCommand("steeragent.showSidebar", () => {
      vscode.commands.executeCommand("steeragent.sidebar.focus");
    }),

    vscode.commands.registerCommand("steeragent.rebuildMap", async () => {
      vscode.window.showInformationMessage("Rebuilding codebase map...");
      try {
        const map = await buildCodebaseMap(cwd);
        const mapPath = join(cwd, ".steer", "codebase-map.json");
        writeFileSync(mapPath, JSON.stringify(map, null, 2));
        vscode.window.showInformationMessage(
          `Codebase map rebuilt: ${Object.keys(map.modules).length} modules, ${Object.keys(map.files).length} files.`,
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Map rebuild failed: ${err.message}`);
      }
    }),
  );
}
