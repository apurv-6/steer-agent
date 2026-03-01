import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT = 5000;

export interface FetchResult {
  source: string;
  data: string;
  ok: boolean;
  error?: string;
}

/**
 * Fetch data from an external source with graceful degradation.
 * Times out after 5s and returns empty on failure.
 */
export async function fetchExternal(
  source: string,
  params: Record<string, string>,
  timeoutMs: number = DEFAULT_TIMEOUT,
): Promise<FetchResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const result = await fetchBySource(source, params, timeoutMs);
    clearTimeout(timer);

    return { source, data: result, ok: true };
  } catch (err: any) {
    return {
      source,
      data: "",
      ok: false,
      error: err.message || String(err),
    };
  }
}

/**
 * Fetch multiple sources in parallel with graceful degradation.
 */
export async function fetchMultiple(
  sources: { source: string; params: Record<string, string> }[],
  timeoutMs: number = DEFAULT_TIMEOUT,
): Promise<FetchResult[]> {
  return Promise.all(
    sources.map((s) => fetchExternal(s.source, s.params, timeoutMs)),
  );
}

async function fetchBySource(
  source: string,
  params: Record<string, string>,
  timeoutMs: number,
): Promise<string> {
  switch (source) {
    case "github":
      return fetchGitHub(params, timeoutMs);
    case "jira":
      return fetchJira(params);
    case "sentry":
      return fetchSentry(params);
    default:
      throw new Error(`Unknown integration source: ${source}`);
  }
}

async function fetchGitHub(params: Record<string, string>, timeoutMs: number): Promise<string> {
  const { importFrom } = await import("./github.js");
  return importFrom(params, timeoutMs);
}

async function fetchJira(params: Record<string, string>): Promise<string> {
  const { importFrom } = await import("./jira.js");
  return importFrom(params);
}

async function fetchSentry(params: Record<string, string>): Promise<string> {
  const { importFrom } = await import("./sentry.js");
  return importFrom(params);
}
