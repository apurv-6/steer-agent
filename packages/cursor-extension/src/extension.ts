import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import { VERSION, telemetry } from "@steer-agent-tool/core";
import { SessionState, type GateMode } from "./SessionState";
import { StatusPanel } from "./StatusPanel";
import { WizardPanel } from "./WizardPanel";
import { callGate, type GateResult } from "./gateClient";

let sessionState: SessionState;
let wizardPanel: WizardPanel;
let telemetryPath: string;

export function activate(context: vscode.ExtensionContext) {
  sessionState = new SessionState(context.workspaceState);
  wizardPanel = new WizardPanel(sessionState);

  // Set up telemetry path in extension global storage
  const telemetryDir = context.globalStorageUri.fsPath;
  telemetryPath = path.join(telemetryDir, "telemetry.jsonl");

  // Restore persisted taskId or generate a fresh one
  const persistedTaskId = context.workspaceState.get<string>("steer.taskId");
  const persistedTurnId = context.workspaceState.get<number>("steer.turnId") ?? 0;
  const persistedGateCallCount = context.workspaceState.get<number>("steer.gateCallCount") ?? 0;

  sessionState.update({
    steerEnabled: true,
    mode: sessionState.data.mode || "dev",
    gateCallCount: persistedGateCallCount,
    turnId: persistedTurnId,
    taskId: persistedTaskId || generateId(),
    lastScore: null,
    lastStatus: null,
    scoreTrend: [],
  });

  // Persist taskId if freshly generated
  if (!persistedTaskId) {
    context.workspaceState.update("steer.taskId", sessionState.data.taskId);
  }

  console.log(`[steer-agent-tool] Extension activated v${VERSION}`);

  // Register webview providers (wrapped in try/catch)
  try {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(StatusPanel.viewType, new StatusPanel(sessionState)),
    );
  } catch (err) {
    vscode.window.showErrorMessage(`[steer] StatusPanel registration failed: ${err}`);
  }

  try {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(WizardPanel.viewType, wizardPanel),
    );
  } catch (err) {
    vscode.window.showErrorMessage(`[steer] WizardPanel registration failed: ${err}`);
  }

  // Register @steer chat participant (wrapped — may not be available in all Cursor versions)
  try {
    const participant = vscode.chat.createChatParticipant("steeragent.steer", async (request, _context, stream, _token) => {
      if (!request.prompt) {
        stream.markdown("Please provide a prompt to evaluate. Usage: `@steer <your prompt>`");
        return;
      }

      const turnId = (sessionState.data.turnId || 0) + 1;
      let gateResult;
      try {
        gateResult = callGate(
          request.prompt,
          sessionState.data.mode,
          undefined,
          sessionState.data.taskId ?? undefined,
          turnId,
        );
      } catch (gateErr) {
        vscode.window.showErrorMessage(`[steer] Gate call failed: ${gateErr}`);
        sessionState.update({ lastStatus: "ERROR" });
        stream.markdown(`### Gate Error\n\nFailed to evaluate prompt: ${gateErr}\n`);
        return;
      }

      sessionState.update({
        gateCallCount: sessionState.data.gateCallCount + 1,
        turnId,
        lastModelTier: gateResult.modelSuggestion.tier,
        lastPatchedPrompt: gateResult.patchedPrompt,
        lastScore: gateResult.score,
        lastStatus: gateResult.status,
      });

      // Persist session state
      context.workspaceState.update("steer.taskId", sessionState.data.taskId);
      context.workspaceState.update("steer.turnId", turnId);
      context.workspaceState.update("steer.gateCallCount", sessionState.data.gateCallCount);

      // Telemetry (best-effort, never crashes)
      appendTelemetry(gateResult, sessionState.data.mode);

      wizardPanel.setDraftPrompt(request.prompt);
      wizardPanel.updateGateResult(gateResult);

      // Stream results inline
      const statusEmoji = gateResult.status === "READY" ? "\u2705" : gateResult.status === "NEEDS_INFO" ? "\u26a0\ufe0f" : "\ud83d\udeab";
      stream.markdown(`### ${statusEmoji} ${gateResult.status} \u2014 Score: ${gateResult.score}/10\n\n`);

      if (gateResult.missing.length > 0) {
        stream.markdown(`**Missing:** ${gateResult.missing.join(", ")}\n\n`);
      }

      // Model routing with explanation
      stream.markdown(`**Model:** ${gateResult.modelSuggestion.tier.toUpperCase()} (${gateResult.modelSuggestion.modelName}) \u2014 ${gateResult.modelSuggestion.reason}\n`);
      if (gateResult.modelSuggestion.explanations.length > 1) {
        for (const exp of gateResult.modelSuggestion.explanations) {
          stream.markdown(`  - ${exp}\n`);
        }
      }
      stream.markdown(`\n**Cost:** ~$${gateResult.costEstimate.estimatedCostUsd.toFixed(4)} (~${gateResult.costEstimate.estimatedTokens} tokens)\n\n`);

      if (gateResult.patchedPrompt) {
        stream.markdown(`**Patched prompt:**\n\`\`\`\n${gateResult.patchedPrompt}\n\`\`\`\n\n`);
        stream.button({ command: "steeragent.applyToChat", title: "Apply to Chat" });
      }

      if (gateResult.followupQuestions.length > 0) {
        stream.markdown("\n**Follow-up questions** (answer in Wizard panel):\n");
        for (const q of gateResult.followupQuestions) {
          stream.markdown(`- ${q.question}\n`);
        }
      }

      stream.markdown(`\n---\n*Gate call #${sessionState.data.gateCallCount} | Task: ${gateResult.taskId} | Turn: ${gateResult.turnId} | Next: ${gateResult.nextAction}*\n`);
    });
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, "icon.svg");
    context.subscriptions.push(participant);
  } catch (err) {
    console.warn("[steer] Chat participant unavailable:", err);
  }

  // steeragent.enable — pick mode and enable
  context.subscriptions.push(
    vscode.commands.registerCommand("steeragent.enable", async () => {
      const modes: GateMode[] = ["dev", "debug", "bugfix", "design", "refactor"];
      const picked = await vscode.window.showQuickPick(modes, {
        placeHolder: "Select steer mode",
      });
      if (picked) {
        const newTaskId = generateId();
        sessionState.update({
          steerEnabled: true,
          mode: picked as GateMode,
          gateCallCount: 0,
          turnId: 0,
          taskId: newTaskId,
          lastScore: null,
          lastStatus: null,
          scoreTrend: [],
        });
        context.workspaceState.update("steer.taskId", newTaskId);
        context.workspaceState.update("steer.turnId", 0);
        context.workspaceState.update("steer.gateCallCount", 0);
        vscode.window.showInformationMessage(`Steer enabled in ${picked} mode (v${VERSION})`);
      }
    }),
  );

  // steeragent.disable
  context.subscriptions.push(
    vscode.commands.registerCommand("steeragent.disable", () => {
      sessionState.update({ steerEnabled: false });
      vscode.window.showInformationMessage("Steer disabled");
    }),
  );

  // steeragent.toggle
  context.subscriptions.push(
    vscode.commands.registerCommand("steeragent.toggle", () => {
      const enabled = !sessionState.data.steerEnabled;
      sessionState.update({ steerEnabled: enabled });
      vscode.window.showInformationMessage(`Steer ${enabled ? "enabled" : "disabled"}`);
    }),
  );

  // steeragent.suggest — trigger gate call
  context.subscriptions.push(
    vscode.commands.registerCommand("steeragent.suggest", async () => {
      if (!sessionState.data.steerEnabled) {
        vscode.window.showWarningMessage("Steer is not enabled. Run 'Steer Agent: Enable' first.");
        return;
      }

      const draftPrompt = await vscode.window.showInputBox({
        prompt: "Enter your draft prompt",
        placeHolder: "Describe the task...",
      });
      if (!draftPrompt) return;

      const turnId = (sessionState.data.turnId || 0) + 1;
      let gateResult;
      try {
        gateResult = callGate(
          draftPrompt,
          sessionState.data.mode,
          undefined,
          sessionState.data.taskId ?? undefined,
          turnId,
        );
      } catch (gateErr) {
        vscode.window.showErrorMessage(`[steer] Gate call failed: ${gateErr}`);
        sessionState.update({ lastStatus: "ERROR" });
        return;
      }

      sessionState.update({
        gateCallCount: sessionState.data.gateCallCount + 1,
        turnId,
        lastModelTier: gateResult.modelSuggestion.tier,
        lastPatchedPrompt: gateResult.patchedPrompt,
        lastScore: gateResult.score,
        lastStatus: gateResult.status,
      });

      // Persist session state
      context.workspaceState.update("steer.taskId", sessionState.data.taskId);
      context.workspaceState.update("steer.turnId", turnId);
      context.workspaceState.update("steer.gateCallCount", sessionState.data.gateCallCount);

      // Telemetry (best-effort, never crashes)
      appendTelemetry(gateResult, sessionState.data.mode);

      wizardPanel.setDraftPrompt(draftPrompt);
      wizardPanel.updateGateResult(gateResult);

      if (gateResult.status === "BLOCKED") {
        vscode.window.showWarningMessage(`BLOCKED (score ${gateResult.score}/10). Missing: ${gateResult.missing.join(", ")}. Check Wizard panel.`);
      } else if (gateResult.status === "NEEDS_INFO") {
        vscode.window.showInformationMessage(`NEEDS_INFO (score ${gateResult.score}/10). Answer follow-ups in Wizard panel.`);
      } else {
        vscode.window.showInformationMessage(`READY (score ${gateResult.score}/10). Model: ${gateResult.modelSuggestion.tier}. Click Apply.`);
      }
    }),
  );

  // steeragent.newTask — reset taskId for a new task
  context.subscriptions.push(
    vscode.commands.registerCommand("steeragent.newTask", () => {
      const newTaskId = generateId();
      sessionState.update({
        gateCallCount: 0,
        turnId: 0,
        taskId: newTaskId,
        lastScore: null,
        lastStatus: null,
        scoreTrend: [],
        lastModelTier: null,
        lastPatchedPrompt: null,
      });
      context.workspaceState.update("steer.taskId", newTaskId);
      context.workspaceState.update("steer.turnId", 0);
      context.workspaceState.update("steer.gateCallCount", 0);
      vscode.window.showInformationMessage(`New task started: ${newTaskId}`);
    }),
  );

  // steeragent.applyToChat
  context.subscriptions.push(
    vscode.commands.registerCommand("steeragent.applyToChat", async () => {
      const lastGateResult = wizardPanel.getLastGateResult();
      if (!lastGateResult) {
        vscode.window.showWarningMessage("No gate result. Run 'Steer Agent: Suggest' first.");
        return;
      }

      let overrideUsed = false;

      if (lastGateResult.status === "BLOCKED") {
        const reason = await vscode.window.showInputBox({
          prompt: "This prompt is BLOCKED. Provide a reason to override:",
          placeHolder: "Why override the block?",
        });
        if (!reason) {
          vscode.window.showInformationMessage("Override cancelled.");
          return;
        }
        overrideUsed = true;
      }

      const textToApply = lastGateResult.patchedPrompt ?? "";

      // Primary: try to fill chat composer via command
      let applied = false;
      try {
        await vscode.commands.executeCommand("workbench.action.chat.open", {
          query: textToApply,
          isPartialQuery: true,
        });
        applied = true;
      } catch {
        // Fallback: copy to clipboard
      }

      if (!applied) {
        await vscode.env.clipboard.writeText(textToApply);
        vscode.window.showInformationMessage("Patched prompt copied to clipboard (chat composer not available).");
      }

      // Log telemetry
      const event = {
        timestamp: new Date().toISOString(),
        event: "applyToChat",
        taskId: sessionState.data.taskId,
        turnId: sessionState.data.turnId,
        gateCallCount: sessionState.data.gateCallCount,
        finalScore: lastGateResult.score,
        scoreTrend: sessionState.data.scoreTrend,
        modelTier: lastGateResult.modelSuggestion.tier,
        overrideUsed,
        mode: sessionState.data.mode,
      };

      telemetry.append(event, telemetryPath).catch(() => {
        // Telemetry is best-effort
      });
    }),
  );

  // Watch .steer/last-gate.json bridge file written by the Cursor hook
  const bridgeWatcher = vscode.workspace.createFileSystemWatcher("**/.steer/last-gate.json");
  let lastBridgeTimestamp = 0;

  const handleBridgeFile = (uri: vscode.Uri) => {
    try {
      const raw = fs.readFileSync(uri.fsPath, "utf-8");
      const bridge = JSON.parse(raw) as {
        timestamp: number;
        draftPrompt: string;
        gateResult: GateResult;
        mode: string;
      };

      // Deduplicate: skip if we already processed this exact timestamp
      if (bridge.timestamp <= lastBridgeTimestamp) return;
      lastBridgeTimestamp = bridge.timestamp;

      const gr = bridge.gateResult;
      const turnId = (sessionState.data.turnId || 0) + 1;

      sessionState.update({
        gateCallCount: sessionState.data.gateCallCount + 1,
        turnId,
        lastModelTier: gr.modelSuggestion.tier,
        lastPatchedPrompt: gr.patchedPrompt,
        lastScore: gr.score,
        lastStatus: gr.status,
      });

      context.workspaceState.update("steer.turnId", turnId);
      context.workspaceState.update("steer.gateCallCount", sessionState.data.gateCallCount);

      wizardPanel.setDraftPrompt(bridge.draftPrompt);
      wizardPanel.updateGateResult(gr);

      appendTelemetry(gr, bridge.mode);
    } catch {
      // Bridge read is best-effort
    }
  };

  bridgeWatcher.onDidChange(handleBridgeFile);
  bridgeWatcher.onDidCreate(handleBridgeFile);
  context.subscriptions.push(bridgeWatcher);

  context.subscriptions.push(sessionState);
}

export function deactivate() {}

function appendTelemetry(gateResult: ReturnType<typeof callGate>, mode: string): void {
  try {
    telemetry.append({
      timestamp: new Date().toISOString(),
      taskId: gateResult.taskId,
      turnId: gateResult.turnId,
      mode,
      score: gateResult.score,
      status: gateResult.status,
      missing: gateResult.missing,
      modelTier: gateResult.modelSuggestion.tier,
      estimatedCostUsd: gateResult.costEstimate.estimatedCostUsd,
      hasGitImpact: gateResult.gitImpact !== null,
    }, telemetryPath).catch(() => {
      // Telemetry must never crash the extension
    });
  } catch {
    // Telemetry must never crash the extension
  }
}

function generateId(): string {
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
