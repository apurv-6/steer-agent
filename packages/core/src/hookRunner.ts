import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { HookDefinition, HooksConfig, HookResult } from "./types.js";

/**
 * Load hooks from .steer/hooks.yaml (simple YAML parser — no dependency).
 * Format:
 *   hooks:
 *     - step: pre-context
 *       check: "test -f package.json"
 *       on_fail: warn
 */
export function loadHooks(cwd: string): HooksConfig {
  const hooksPath = join(cwd, ".steer", "hooks.yaml");
  if (!existsSync(hooksPath)) {
    return { hooks: [] };
  }

  const raw = readFileSync(hooksPath, "utf-8");
  return parseHooksYaml(raw);
}

/**
 * Minimal YAML parser for hooks.yaml — handles our known structure only.
 * Avoids adding a YAML dependency to the zero-deps core package.
 */
export function parseHooksYaml(raw: string): HooksConfig {
  const hooks: HookDefinition[] = [];
  const lines = raw.split("\n");
  let current: Partial<HookDefinition> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- step:")) {
      if (current && current.step) {
        hooks.push({ on_fail: "warn", ...current } as HookDefinition);
      }
      current = { step: trimmed.replace("- step:", "").trim().replace(/^["']|["']$/g, "") };
    } else if (current) {
      const match = trimmed.match(/^(check|run|on_fail):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        const cleanValue = value.trim().replace(/^["']|["']$/g, "");
        (current as any)[key] = cleanValue;
      }
    }
  }

  if (current && current.step) {
    hooks.push({ on_fail: "warn", ...current } as HookDefinition);
  }

  return { hooks };
}

/**
 * Run all hooks matching a given step name (e.g. "pre-context", "post-execution").
 */
export function runHooks(
  stepName: string,
  hooks: HooksConfig,
  cwd: string,
): HookResult[] {
  const matching = hooks.hooks.filter((h) => h.step === stepName);
  return matching.map((hook) => runSingleHook(hook, cwd));
}

function runSingleHook(hook: HookDefinition, cwd: string): HookResult {
  // Run check command if present
  if (hook.check) {
    try {
      execSync(hook.check, { cwd, stdio: "pipe", timeout: 10000 });
    } catch {
      return {
        hookStep: hook.step,
        passed: false,
        output: `Check failed: ${hook.check}`,
        action: hook.on_fail,
      };
    }
  }

  // Run action command if present
  if (hook.run) {
    try {
      const output = execSync(hook.run, { cwd, stdio: "pipe", timeout: 30000 });
      return {
        hookStep: hook.step,
        passed: true,
        output: output.toString().trim(),
        action: hook.on_fail,
      };
    } catch (err: any) {
      return {
        hookStep: hook.step,
        passed: false,
        output: err.stderr?.toString() || err.message,
        action: hook.on_fail,
      };
    }
  }

  return { hookStep: hook.step, passed: true, action: hook.on_fail };
}
