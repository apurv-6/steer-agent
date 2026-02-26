import * as fs from "node:fs";
import * as childProcess from "node:child_process";
import type { HookDefinition, HookResult, HookTrigger, HookOnFail } from "./types.js";

/**
 * Parse a simple hooks.yaml file.
 * Format:
 *   hooks:
 *     trigger-name:
 *       - check: condition_name
 *         on_fail: block|warn|skip
 *         message: "..."
 *       - run: "shell command"
 *         on_fail: warn
 *         message: "..."
 */
export function loadHooks(hooksPath: string): HookDefinition[] {
  if (!fs.existsSync(hooksPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(hooksPath, "utf-8");
    return parseHooksYaml(content);
  } catch {
    return [];
  }
}

/**
 * Minimal YAML parser for the hooks format.
 * Only supports the specific structure used by SteerAgent hooks.
 */
export function parseHooksYaml(content: string): HookDefinition[] {
  const hooks: HookDefinition[] = [];
  const lines = content.split("\n");
  let currentTrigger: HookTrigger | null = null;
  let currentHook: Partial<HookDefinition> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Skip comments and empty lines
    if (line.trim().startsWith("#") || line.trim() === "" || line.trim() === "hooks:") {
      continue;
    }

    // Trigger level (2-space indent): "  pre-context:"
    const triggerMatch = line.match(/^  ([a-z-]+):$/);
    if (triggerMatch) {
      if (currentHook && currentTrigger) {
        hooks.push({ trigger: currentTrigger, on_fail: "skip", message: "", ...currentHook } as HookDefinition);
        currentHook = null;
      }
      currentTrigger = triggerMatch[1] as HookTrigger;
      continue;
    }

    // Hook entry start (4-space indent + dash): "    - check: ..."
    const entryMatch = line.match(/^\s{4}-\s+(check|run):\s*(.+)$/);
    if (entryMatch && currentTrigger) {
      // Save previous hook if any
      if (currentHook) {
        hooks.push({ trigger: currentTrigger, on_fail: "skip", message: "", ...currentHook } as HookDefinition);
      }
      currentHook = {};
      if (entryMatch[1] === "check") {
        currentHook.check = entryMatch[2]!.trim().replace(/^["']|["']$/g, "");
      } else {
        currentHook.run = entryMatch[2]!.trim().replace(/^["']|["']$/g, "");
      }
      continue;
    }

    // Hook properties (6-space indent): "      on_fail: block"
    const propMatch = line.match(/^\s{6,}(\w+):\s*(.+)$/);
    if (propMatch && currentHook) {
      const key = propMatch[1]!;
      let value: unknown = propMatch[2]!.trim().replace(/^["']|["']$/g, "");
      if (key === "on_fail") {
        currentHook.on_fail = value as HookOnFail;
      } else if (key === "message") {
        currentHook.message = value as string;
      } else if (key === "files") {
        // Parse array: ["a/", "b/"]
        if (typeof value === "string" && value.startsWith("[")) {
          currentHook.files = value
            .slice(1, -1)
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""));
        }
      }
    }
  }

  // Push last hook
  if (currentHook && currentTrigger) {
    hooks.push({ trigger: currentTrigger, on_fail: "skip", message: "", ...currentHook } as HookDefinition);
  }

  return hooks;
}

/**
 * Built-in check evaluators.
 * Deterministic conditions — no AI.
 */
const CHECK_EVALUATORS: Record<string, (ctx: HookContext) => boolean> = {
  template_exists: (ctx) => ctx.templateLoaded === true,
  jira_attached: (ctx) => !!ctx.jiraTicket,
  sentry_checked: (ctx) => !!ctx.sentryChecked,
  critical_file_guard: (ctx) => {
    if (!ctx.files || !ctx.criticalModules) return true; // No files = pass
    return !ctx.files.some((f) =>
      ctx.criticalModules!.some((cm) => f.startsWith(cm)),
    );
  },
  open_pr_conflict: (ctx) => !ctx.openPRConflicts || ctx.openPRConflicts.length === 0,
  conventional_commit_format: (ctx) => {
    if (!ctx.commitMessage) return true;
    return /^(fix|feat|refactor|docs|test|chore|style|perf|ci|build)\(?.+\)?:/.test(ctx.commitMessage);
  },
  pr_has_tests: (ctx) => {
    if (!ctx.prDescription) return true;
    return /test/i.test(ctx.prDescription);
  },
};

export interface HookContext {
  templateLoaded?: boolean;
  jiraTicket?: string;
  sentryChecked?: boolean;
  files?: string[];
  criticalModules?: string[];
  openPRConflicts?: string[];
  commitMessage?: string;
  prDescription?: string;
  cwd?: string;
  [key: string]: unknown;
}

/**
 * Run all hooks for a given trigger point.
 * Returns results and throws if any hook with on_fail=block fails.
 */
export function runHooks(
  trigger: HookTrigger,
  hooks: HookDefinition[],
  context: HookContext,
): HookResult[] {
  const results: HookResult[] = [];
  const triggerHooks = hooks.filter((h) => h.trigger === trigger);

  for (const hook of triggerHooks) {
    let passed = true;
    let message = hook.message;

    if (hook.check) {
      // Evaluate built-in check
      const evaluator = CHECK_EVALUATORS[hook.check];
      if (evaluator) {
        // For critical_file_guard, invert: returns false if critical files ARE hit
        passed = evaluator(context);
      } else {
        // Unknown check → skip
        results.push({ trigger, check: hook.check, result: "skip", message: `Unknown check: ${hook.check}` });
        continue;
      }
    } else if (hook.run) {
      // Execute shell command
      try {
        childProcess.execSync(hook.run, {
          cwd: context.cwd ?? process.cwd(),
          timeout: 5000,
          stdio: "pipe",
        });
        passed = true;
      } catch (err) {
        passed = false;
        if (err instanceof Error) {
          message = `${hook.message} (${err.message})`;
        }
      }
    }

    if (passed) {
      results.push({ trigger, check: hook.check, run: hook.run, result: "pass", message: "" });
    } else {
      const result: HookResult = {
        trigger,
        check: hook.check,
        run: hook.run,
        result: hook.on_fail === "skip" ? "skip" : "fail",
        message,
      };
      results.push(result);

      if (hook.on_fail === "block") {
        // Throw to stop workflow
        const error = new HookBlockError(message, result);
        throw error;
      }
      // warn and skip just continue
    }
  }

  return results;
}

export class HookBlockError extends Error {
  public hookResult: HookResult;
  constructor(message: string, result: HookResult) {
    super(message);
    this.name = "HookBlockError";
    this.hookResult = result;
  }
}
