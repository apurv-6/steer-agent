import * as vscode from "vscode";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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

      vscode.window.showInformationMessage(`Starting task: ${goal} (${mode})`);
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
        await execAsync(`npx steer-agent-tool map --rebuild`, { cwd, timeout: 30000 });
        vscode.window.showInformationMessage("Codebase map rebuilt.");
      } catch (err: any) {
        vscode.window.showErrorMessage(`Map rebuild failed: ${err.message}`);
      }
    }),
  );
}
