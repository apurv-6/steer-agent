// Re-export canonical gate from core. No more duplication.
import { gate as coreGate, type GateResult, type GateInput, type GateMode } from "@steer-agent-tool/core";
import type { GateMode as ExtGateMode } from "./SessionState";

export type { GateResult };

/**
 * Thin wrapper: converts extension GateMode + optional answers into GateInput.
 */
export function callGate(
  draftPrompt: string,
  mode: ExtGateMode,
  answers?: Record<string, string>,
  taskId?: string,
  turnId?: number,
): GateResult {
  return coreGate({
    draftPrompt,
    mode: mode as GateMode,
    taskId,
    turnId,
    answers,
  });
}
