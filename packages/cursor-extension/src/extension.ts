import * as vscode from "vscode";
import { VERSION } from "@steer-agent-tool/core";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "steer-agent-tool.helloWorld",
    () => {
      vscode.window.showInformationMessage(
        `Steer Agent Tool v${VERSION}`
      );
    }
  );
  context.subscriptions.push(disposable);
}

export function deactivate() {}
